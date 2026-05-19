// Background processor for import_jobs
// Handles two kinds of rows:
//  - SALE rows (default): creates customers, products, sales_orders, sale_items, finance_transactions
//  - FINANCE rows (when row.fin_type is set): creates accounts_payable / accounts_receivable
//    and, when status=paid, also a finance_transactions entry
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Row = {
  total_amount: number;
  payment_method: string;
  status: string;
  notes: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  customer_document?: string;
  product_name?: string;
  product_quantity?: number;
  product_price?: number;
  product_sku?: string;
  discount?: number;
  description?: string;
  fin_type?: "income" | "expense";
  category?: string;
};

const CHUNK = 500;
const PARALLEL = 6;

async function pool<T>(tasks: (() => Promise<T>)[], concurrency: number) {
  const out: T[] = new Array(tasks.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (i < tasks.length) {
        const idx = i++;
        out[idx] = await tasks[idx]();
      }
    }),
  );
  return out;
}

async function processJob(supabase: any, jobId: string) {
  const { data: job, error: jobErr } = await supabase
    .from("import_jobs").select("*").eq("id", jobId).maybeSingle();
  if (jobErr || !job) throw new Error("job not found");
  if (job.status === "done") return;

  const orgId = job.organization_id as string;
  const userId = job.user_id as string;
  const allRows = (job.payload || []) as Row[];

  // Insere stampando import_job_id; se a coluna ainda não existir no schema,
  // refaz a inserção sem ela (deleção em cascata só funciona após migração).
  const insertTagged = async (table: string, rows: any[]) => {
    if (!rows.length) return { error: null, count: 0 };
    const tagged = rows.map((r) => ({ ...r, import_job_id: jobId }));
    let { error } = await supabase.from(table).insert(tagged);
    if (error && /import_job_id/i.test(error.message)) {
      const r2 = await supabase.from(table).insert(rows);
      error = r2.error;
    }
    return { error, count: rows.length };
  };



  // Split: financial rows (have fin_type) vs sale rows
  // SAFETY NET: se a linha tem product_name OU customer_name OU job rotulado
  // como [Vendas], ela SEMPRE é tratada como venda — mesmo que algum mapeamento
  // tenha inferido fin_type por engano (ex.: descrição "Venda ...").
  const jobLabel = String(job.label || "").toLowerCase();
  const forceSales = /vendas|sale|sales|pedido|order/.test(jobLabel);
  const looksLikeSale = (r: Row) =>
    !!r.product_name || !!r.customer_name || !!r.customer_document;
  const finRows = allRows.filter((r) => {
    if (forceSales) return false;
    if (looksLikeSale(r)) return false;
    return r.fin_type === "income" || r.fin_type === "expense";
  });
  const saleRows = allRows.filter((r) => !finRows.includes(r));

  await supabase.from("import_jobs").update({
    status: "running", started_at: new Date().toISOString(), step: "customers", processed: 0, total: allRows.length,
  }).eq("id", jobId);

  const counters = { sales: 0, customers: 0, products: 0, finance: 0, totalAmount: 0 };

  try {
    // ============================================================
    // FINANCE-ONLY IMPORT PATH
    // ============================================================
    if (finRows.length > 0) {
      await supabase.from("import_jobs").update({ step: "finance" }).eq("id", jobId);

      const payable: any[] = [];
      const receivable: any[] = [];
      const finTx: any[] = [];

      for (const r of finRows) {
        const isPaid = ["paid", "pago", "concluded", "concluido", "concluído", "quitado", "recebido"]
          .includes((r.status || "").toLowerCase());
        const amount = Number(r.total_amount) || 0;
        const dueDate = (r.created_at || new Date().toISOString()).split("T")[0];
        const desc = (r.description || r.notes || `Importado · ${r.fin_type}`).slice(0, 500);

        if (r.fin_type === "expense") {
          payable.push({
            organization_id: orgId, user_id: userId,
            description: desc,
            amount,
            due_date: dueDate,
            status: isPaid ? "paid" : "pending",
            paid_at: isPaid ? (r.created_at || new Date().toISOString()) : null,
            paid_amount: isPaid ? amount : null,
            category: r.category || null,
            notes: [
              r.payment_method ? `Pagamento: ${r.payment_method}` : null,
              r.customer_name ? `Fornecedor: ${r.customer_name}` : null,
              r.notes && r.notes !== desc ? r.notes : null,
            ].filter(Boolean).join("\n") || null,
          });
        } else {
          receivable.push({
            organization_id: orgId, user_id: userId,
            description: desc,
            amount,
            due_date: dueDate,
            status: isPaid ? "paid" : "pending",
            paid_at: isPaid ? (r.created_at || new Date().toISOString()) : null,
            paid_amount: isPaid ? amount : null,
            notes: [
              r.payment_method ? `Pagamento: ${r.payment_method}` : null,
              r.customer_name ? `Cliente: ${r.customer_name}` : null,
              r.category ? `Categoria: ${r.category}` : null,
              r.notes && r.notes !== desc ? r.notes : null,
            ].filter(Boolean).join("\n") || null,
          });
        }

        // Espelha movimentos quitados em finance_transactions (caixa)
        if (isPaid) {
          finTx.push({
            organization_id: orgId, user_id: userId,
            type: r.fin_type,
            amount,
            description: desc,
            category: r.category || (r.fin_type === "expense" ? "expense" : "income"),
            payment_method: r.payment_method || null,
            reference_type: "import",
            transaction_date: r.created_at || new Date().toISOString(),
          });
        }

        counters.totalAmount += amount;
      }

      const insertChunks = async (table: string, rows: any[]) => {
        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK);
          const { error } = await insertTagged(table, slice);
          if (!error) counters.finance += slice.length;
          else throw new Error(`${table}: ${error.message}`);
          await supabase.from("import_jobs")
            .update({ processed: counters.finance + counters.sales })
            .eq("id", jobId);
        }
      };

      if (payable.length) await insertChunks("accounts_payable", payable);
      if (receivable.length) await insertChunks("accounts_receivable", receivable);
      if (finTx.length) {
        for (let i = 0; i < finTx.length; i += CHUNK) {
          const slice = finTx.slice(i, i + CHUNK);
          await insertTagged("finance_transactions", slice);
        }
      }
    }

    // ============================================================
    // SALES IMPORT PATH (original flow)
    // ============================================================
    if (saleRows.length > 0) {
      const rows = saleRows;

      // 1) CUSTOMERS
      await supabase.from("import_jobs").update({ step: "customers" }).eq("id", jobId);
      type CustAcc = { name: string; phone?: string; email?: string; document?: string; keys: Set<string> };
      const customerMap = new Map<string, CustAcc>();
      const aliasToKey = new Map<string, string>();
      for (const r of rows) {
        const name = r.customer_name?.trim();
        const doc = r.customer_document?.trim();
        if (!name && !doc) continue;
        const primary = doc || name!.toLowerCase();
        const aliases = [doc, name?.toLowerCase()].filter(Boolean) as string[];
        let existing: CustAcc | undefined;
        for (const a of aliases) {
          const k = aliasToKey.get(a);
          if (k && customerMap.has(k)) { existing = customerMap.get(k); break; }
        }
        if (!existing) {
          existing = { name: name || doc || "Cliente", phone: r.customer_phone, email: r.customer_email, document: doc, keys: new Set() };
          customerMap.set(primary, existing);
        }
        if (!existing.phone && r.customer_phone) existing.phone = r.customer_phone;
        if (!existing.email && r.customer_email) existing.email = r.customer_email;
        if (!existing.document && doc) existing.document = doc;
        if (name && existing.name === doc) existing.name = name;
        aliases.forEach((a) => { aliasToKey.set(a, primary); existing!.keys.add(a); });
      }

      const customerIdByAlias = new Map<string, string>();
      if (customerMap.size > 0) {
        const all = Array.from(customerMap.values());
        const docs = all.map((c) => c.document).filter(Boolean) as string[];
        const names = all.map((c) => c.name);
        const [byDoc, byName] = await Promise.all([
          docs.length
            ? supabase.from("customers").select("id,name,document").eq("organization_id", orgId).in("document", docs)
            : Promise.resolve({ data: [] }),
          supabase.from("customers").select("id,name,document").eq("organization_id", orgId).in("name", names),
        ]);
        const link = (rec: any) => {
          if (rec.document) customerIdByAlias.set(rec.document, rec.id);
          if (rec.name) customerIdByAlias.set(rec.name.toLowerCase(), rec.id);
        };
        (byDoc.data || []).forEach(link);
        (byName.data || []).forEach(link);
        const toCreate = all.filter((c) => {
          for (const k of c.keys) if (customerIdByAlias.has(k)) return false;
          return true;
        });
        if (toCreate.length) {
          const chunks: CustAcc[][] = [];
          for (let i = 0; i < toCreate.length; i += CHUNK) chunks.push(toCreate.slice(i, i + CHUNK));
          await pool(chunks.map((c) => async () => {
            const { data } = await supabase.from("customers").insert(c.map((x) => ({
              organization_id: orgId, user_id: userId,
              name: x.name, phone: x.phone || null, email: x.email || null, document: x.document || null,
            }))).select("id,name,document");
            (data || []).forEach((rec: any, i: number) => {
              c[i].keys.forEach((k) => customerIdByAlias.set(k, rec.id));
              counters.customers++;
            });
          }), PARALLEL);
        }
      }
      const resolveCust = (r: Row) => {
        if (r.customer_document && customerIdByAlias.has(r.customer_document)) return customerIdByAlias.get(r.customer_document)!;
        if (r.customer_name && customerIdByAlias.has(r.customer_name.toLowerCase())) return customerIdByAlias.get(r.customer_name.toLowerCase())!;
        return null;
      };

      // 2) PRODUCTS  (+ sincronização com estoque atual)
      await supabase.from("import_jobs").update({ step: "products" }).eq("id", jobId);
      // Agrega quantidade total importada por produto (alimenta o estoque)
      const productMap = new Map<string, { name: string; price?: number; sku?: string; totalQty: number }>();
      for (const r of rows) {
        if (!r.product_name) continue;
        const key = r.product_name.toLowerCase();
        const qty = Number(r.product_quantity) || 1;
        const cur = productMap.get(key);
        if (cur) {
          cur.totalQty += qty;
          if (!cur.sku && r.product_sku) cur.sku = r.product_sku;
        } else {
          productMap.set(key, {
            name: r.product_name,
            price: r.product_price ?? r.total_amount,
            sku: r.product_sku,
            totalQty: qty,
          });
        }
      }
      const productIdByName = new Map<string, string>();
      const newProductIds: { id: string; key: string; qty: number }[] = [];
      if (productMap.size > 0) {
        const all = Array.from(productMap.values());
        const { data: existing } = await supabase.from("products").select("id,name").eq("organization_id", orgId).in("name", all.map((p) => p.name));
        (existing || []).forEach((p: any) => productIdByName.set(p.name.toLowerCase(), p.id));
        const toCreate = all.filter((p) => !productIdByName.has(p.name.toLowerCase()));
        if (toCreate.length) {
          const chunks: typeof toCreate[] = [];
          for (let i = 0; i < toCreate.length; i += CHUNK) chunks.push(toCreate.slice(i, i + CHUNK));
          await pool(chunks.map((c) => async () => {
            const payload = c.map((p) => ({
              organization_id: orgId, user_id: userId, name: p.name,
              sku: p.sku || null,
              price: p.price ?? 0, category: "Importado", active: true,
              stock_quantity: p.totalQty,
              min_stock: 1,
              status: "in_stock",
            }));
            let { data, error } = await supabase.from("products").insert(payload).select("id,name");
            // Fallback se alguma coluna não existir no schema (sku/status/min_stock)
            if (error) {
              const simple = c.map((p) => ({
                organization_id: orgId, user_id: userId, name: p.name,
                price: p.price ?? 0, category: "Importado", active: true,
                stock_quantity: p.totalQty,
              }));
              const r2 = await supabase.from("products").insert(simple).select("id,name");
              data = r2.data; error = r2.error;
            }
            (data || []).forEach((rec: any) => {
              const key = rec.name.toLowerCase();
              productIdByName.set(key, rec.id);
              const meta = productMap.get(key);
              newProductIds.push({ id: rec.id, key, qty: meta?.totalQty ?? 0 });
              counters.products++;
            });
          }), PARALLEL);
        }
      }

      // Registra movimentação de ENTRADA por produto novo (referência: import),
      // garantindo que o estoque atual reflita a quantidade trazida pela importação.
      if (newProductIds.length > 0) {
        const moves = newProductIds
          .filter((p) => p.qty > 0)
          .map((p) => ({
            organization_id: orgId, user_id: userId,
            product_id: p.id,
            movement_type: "in",
            quantity: p.qty,
            reason: "Importação de vendas",
            reference_type: "import",
            reference_id: jobId,
          }));
        for (let i = 0; i < moves.length; i += CHUNK) {
          await supabase.from("stock_movements").insert(moves.slice(i, i + CHUNK));
        }
      }

      // 3) SALES
      await supabase.from("import_jobs").update({ step: "sales" }).eq("id", jobId);
      const inserted: { id: string; row: Row }[] = new Array(rows.length);
      const saleChunks: { offset: number; slice: Row[] }[] = [];
      for (let i = 0; i < rows.length; i += CHUNK) saleChunks.push({ offset: i, slice: rows.slice(i, i + CHUNK) });

      await pool(saleChunks.map(({ offset, slice }) => async () => {
        const payload = slice.map((r) => {
          const disc = Number(r.discount) || 0;
          const total = Number(r.total_amount) || 0;
          return {
            user_id: userId, organization_id: orgId,
            total_amount: total,
            subtotal: total + disc,
            discount: disc,
            payment_method: r.payment_method, status: r.status,
            notes: r.notes, channel: "import",
            customer_id: resolveCust(r),
            created_at: r.created_at,
            import_job_id: jobId,
          };
        });
        let { data, error } = await supabase.from("sales_orders").insert(payload).select("id");
        if (error && /import_job_id/i.test(error.message)) {
          const fallback = payload.map(({ import_job_id, ...rest }) => rest);
          const r2 = await supabase.from("sales_orders").insert(fallback).select("id");
          data = r2.data; error = r2.error;
        }
        if (error) throw error;
        (data || []).forEach((s: any, i: number) => {
          inserted[offset + i] = { id: s.id, row: slice[i] };
          counters.sales++;
          counters.totalAmount += slice[i].total_amount;
        });
        await supabase.from("import_jobs").update({ processed: counters.sales + counters.finance }).eq("id", jobId);
      }), PARALLEL);

      const ok = inserted.filter(Boolean);

      // 4 + 5) ITEMS + FINANCE
      await supabase.from("import_jobs").update({ step: "items" }).eq("id", jobId);
      const saleItems = ok.filter(({ row }) => row.product_name && productIdByName.has(row.product_name.toLowerCase()))
        .map(({ id, row }) => ({
          organization_id: orgId, sale_id: id,
          product_id: productIdByName.get(row.product_name!.toLowerCase())!,
          product_name: row.product_name!,
          sku: row.product_sku || null,
          quantity: row.product_quantity || 1,
          unit_price: row.product_price ?? row.total_amount,
          discount: Number(row.discount) || 0,
          total: row.total_amount,
        }));
      const PAID_STATUSES = ["concluded", "completed", "paid", "concluido", "concluído", "pago", "quitado", "recebido"];
      const isPaidSale = (s: string) => PAID_STATUSES.includes((s || "").toLowerCase());

      const financeRows = ok.filter(({ row }) => isPaidSale(row.status))
        .map(({ id, row }) => ({
          organization_id: orgId, user_id: userId, type: "income",
          amount: row.total_amount,
          description: `Venda importada${row.customer_name ? ` · ${row.customer_name}` : ""}`,
          category: "sales", payment_method: row.payment_method,
          reference_type: "sale", reference_id: id,
          transaction_date: row.created_at,
        }));

      // Espelha TODA venda importada em accounts_receivable (Receitas)
      const receivableRows = ok.map(({ id, row }) => {
        const paid = isPaidSale(row.status);
        const date = (row.created_at || new Date().toISOString()).split("T")[0];
        return {
          organization_id: orgId, user_id: userId,
          description: `Venda importada${row.customer_name ? ` · ${row.customer_name}` : ""}`,
          amount: row.total_amount,
          due_date: date,
          status: paid ? "paid" : "pending",
          paid_at: paid ? (row.created_at || new Date().toISOString()) : null,
          paid_amount: paid ? row.total_amount : null,
          customer_id: resolveCust(row),
          sale_id: id,
          notes: [
            row.payment_method ? `Pagamento: ${row.payment_method}` : null,
            row.customer_name ? `Cliente: ${row.customer_name}` : null,
          ].filter(Boolean).join("\n") || null,
        };
      });

      const itemChunks: typeof saleItems[] = [];
      for (let i = 0; i < saleItems.length; i += CHUNK) itemChunks.push(saleItems.slice(i, i + CHUNK));
      const finChunks: typeof financeRows[] = [];
      for (let i = 0; i < financeRows.length; i += CHUNK) finChunks.push(financeRows.slice(i, i + CHUNK));
      const recvChunks: typeof receivableRows[] = [];
      for (let i = 0; i < receivableRows.length; i += CHUNK) recvChunks.push(receivableRows.slice(i, i + CHUNK));

      await Promise.all([
        pool(itemChunks.map((c) => async () => { await insertTagged("sale_items", c); }), PARALLEL),
        pool(finChunks.map((c) => async () => {
          const { error } = await insertTagged("finance_transactions", c);
          if (!error) counters.finance += c.length;
        }), PARALLEL),
        pool(recvChunks.map((c) => async () => {
          // tenta com colunas estendidas + tag; faz fallback se schema não tiver
          const tagged = c.map((r) => ({ ...r, import_job_id: jobId }));
          let { error } = await supabase.from("accounts_receivable").insert(tagged);
          if (error) {
            // tenta sem import_job_id, mantendo customer_id/sale_id
            const noTag = c.map((r) => ({ ...r }));
            let r2 = await supabase.from("accounts_receivable").insert(noTag);
            if (r2.error) {
              // último fallback: sem colunas estendidas
              const minimal = c.map(({ customer_id, sale_id, ...rest }) => rest);
              r2 = await supabase.from("accounts_receivable").insert(minimal);
            }
            error = r2.error;
          }
          if (!error) counters.finance += c.length;
        }), PARALLEL),
      ]);
    }

    await supabase.from("import_jobs").update({
      status: "done", step: "done", finished_at: new Date().toISOString(),
      processed: counters.sales + counters.finance, result: counters,
      payload: [], // libera espaço
    }).eq("id", jobId);
  } catch (err: any) {
    await supabase.from("import_jobs").update({
      status: "error", error: err?.message || "erro desconhecido",
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
    throw err;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { jobId } = await req.json();
    if (!jobId) return new Response(JSON.stringify({ error: "jobId obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // EdgeRuntime.waitUntil mantém a função viva após o response
    // @ts-ignore
    EdgeRuntime.waitUntil(processJob(supabase, jobId).catch((e) => console.error("import error", e)));

    return new Response(JSON.stringify({ ok: true, jobId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
