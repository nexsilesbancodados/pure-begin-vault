// Background processor for import_jobs
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
  const rows = (job.payload || []) as Row[];

  await supabase.from("import_jobs").update({
    status: "running", started_at: new Date().toISOString(), step: "customers", processed: 0, total: rows.length,
  }).eq("id", jobId);

  const counters = { sales: 0, customers: 0, products: 0, finance: 0, totalAmount: 0 };

  try {
    // 1) CUSTOMERS
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

    // 2) PRODUCTS
    await supabase.from("import_jobs").update({ step: "products" }).eq("id", jobId);
    const productMap = new Map<string, { name: string; price?: number }>();
    for (const r of rows) {
      if (r.product_name) {
        const key = r.product_name.toLowerCase();
        if (!productMap.has(key)) productMap.set(key, { name: r.product_name, price: r.product_price ?? r.total_amount });
      }
    }
    const productIdByName = new Map<string, string>();
    if (productMap.size > 0) {
      const all = Array.from(productMap.values());
      const { data: existing } = await supabase.from("products").select("id,name").eq("organization_id", orgId).in("name", all.map((p) => p.name));
      (existing || []).forEach((p: any) => productIdByName.set(p.name.toLowerCase(), p.id));
      const toCreate = all.filter((p) => !productIdByName.has(p.name.toLowerCase()));
      if (toCreate.length) {
        const chunks: typeof toCreate[] = [];
        for (let i = 0; i < toCreate.length; i += CHUNK) chunks.push(toCreate.slice(i, i + CHUNK));
        await pool(chunks.map((c) => async () => {
          const { data } = await supabase.from("products").insert(c.map((p) => ({
            organization_id: orgId, user_id: userId, name: p.name,
            price: p.price ?? 0, category: "Importado", active: true,
          }))).select("id,name");
          (data || []).forEach((rec: any) => {
            productIdByName.set(rec.name.toLowerCase(), rec.id);
            counters.products++;
          });
        }), PARALLEL);
      }
    }

    // 3) SALES
    await supabase.from("import_jobs").update({ step: "sales" }).eq("id", jobId);
    const inserted: { id: string; row: Row }[] = new Array(rows.length);
    const saleChunks: { offset: number; slice: Row[] }[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) saleChunks.push({ offset: i, slice: rows.slice(i, i + CHUNK) });

    await pool(saleChunks.map(({ offset, slice }) => async () => {
      const payload = slice.map((r) => ({
        user_id: userId, organization_id: orgId,
        total_amount: r.total_amount, subtotal: r.total_amount,
        payment_method: r.payment_method, status: r.status,
        notes: r.notes, channel: "import",
        customer_id: resolveCust(r),
        created_at: r.created_at,
      }));
      const { data, error } = await supabase.from("sales_orders").insert(payload).select("id");
      if (error) throw error;
      (data || []).forEach((s: any, i: number) => {
        inserted[offset + i] = { id: s.id, row: slice[i] };
        counters.sales++;
        counters.totalAmount += slice[i].total_amount;
      });
      await supabase.from("import_jobs").update({ processed: counters.sales }).eq("id", jobId);
    }), PARALLEL);

    const ok = inserted.filter(Boolean);

    // 4 + 5) ITEMS + FINANCE
    await supabase.from("import_jobs").update({ step: "items" }).eq("id", jobId);
    const saleItems = ok.filter(({ row }) => row.product_name && productIdByName.has(row.product_name.toLowerCase()))
      .map(({ id, row }) => ({
        organization_id: orgId, sale_id: id,
        product_id: productIdByName.get(row.product_name!.toLowerCase())!,
        product_name: row.product_name!,
        quantity: row.product_quantity || 1,
        unit_price: row.product_price ?? row.total_amount,
        total: row.total_amount,
      }));
    const financeRows = ok.filter(({ row }) => row.status === "concluded")
      .map(({ id, row }) => ({
        organization_id: orgId, user_id: userId, type: "income",
        amount: row.total_amount,
        description: `Venda importada${row.customer_name ? ` · ${row.customer_name}` : ""}`,
        category: "sales", payment_method: row.payment_method,
        reference_type: "sale", reference_id: id,
        transaction_date: row.created_at,
      }));

    const itemChunks: typeof saleItems[] = [];
    for (let i = 0; i < saleItems.length; i += CHUNK) itemChunks.push(saleItems.slice(i, i + CHUNK));
    const finChunks: typeof financeRows[] = [];
    for (let i = 0; i < financeRows.length; i += CHUNK) finChunks.push(financeRows.slice(i, i + CHUNK));

    await Promise.all([
      pool(itemChunks.map((c) => async () => { await supabase.from("sale_items").insert(c); }), PARALLEL),
      pool(finChunks.map((c) => async () => {
        const { error } = await supabase.from("finance_transactions").insert(c);
        if (!error) counters.finance += c.length;
      }), PARALLEL),
    ]);

    await supabase.from("import_jobs").update({
      status: "done", step: "done", finished_at: new Date().toISOString(),
      processed: counters.sales, result: counters,
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
