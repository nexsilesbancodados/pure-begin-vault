import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

// Linha "pronta" enviada pelo modal (já validada/normalizada).
export type ImportRow = {
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

export type ImportJob = {
  id: string;
  fileName: string;
  startedAt: number;
  finishedAt?: number;
  total: number;
  processed: number;
  status: "running" | "done" | "error";
  step: "preparing" | "customers" | "products" | "sales" | "items" | "finance" | "done";
  result?: { sales: number; customers: number; products: number; finance: number; totalAmount: number };
  error?: string;
};

type Ctx = {
  jobs: ImportJob[];
  activeCount: number;
  startImport: (fileName: string, rows: ImportRow[]) => string;
  clearFinished: () => void;
};

const ImportCtx = createContext<Ctx | null>(null);

// ─── tuning ────────────────────────────────────────────────────────────────
// Bulk chunk size — Supabase limita ~1000/insert, 500 é o sweet spot.
const CHUNK = 500;
// Quantos chunks rodam em paralelo (cada chunk = 1 ida de rede).
const PARALLEL = 6;

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number) {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const i = cursor++;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

export function ImportProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  // ref para os jobs atuais (acessível dentro do worker assíncrono)
  const jobsRef = useRef<ImportJob[]>([]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  const updateJob = useCallback((id: string, patch: Partial<ImportJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const runImport = useCallback(
    async (jobId: string, rows: ImportRow[]) => {
      if (!user?.id || !orgId) {
        updateJob(jobId, { status: "error", error: "Usuário não autenticado", finishedAt: Date.now() });
        return;
      }
      const counters = { sales: 0, customers: 0, products: 0, finance: 0, totalAmount: 0 };

      try {
        // ───────────────────────────── 1) CLIENTES (bulk + dedupe por doc/nome)
        updateJob(jobId, { step: "customers" });
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
          const allCustomers = Array.from(customerMap.values());
          const docs = allCustomers.map((c) => c.document).filter(Boolean) as string[];
          const names = allCustomers.map((c) => c.name);
          const [byDoc, byName] = await Promise.all([
            docs.length
              ? supabase.from("customers").select("id, name, document").eq("organization_id", orgId).in("document", docs)
              : Promise.resolve({ data: [] as any[] }),
            supabase.from("customers").select("id, name, document").eq("organization_id", orgId).in("name", names),
          ]);
          const link = (rec: any) => {
            if (rec.document) customerIdByAlias.set(rec.document, rec.id);
            if (rec.name) customerIdByAlias.set(rec.name.toLowerCase(), rec.id);
          };
          (byDoc.data || []).forEach(link);
          (byName.data || []).forEach(link);
          const toCreate = allCustomers.filter((c) => {
            for (const k of c.keys) if (customerIdByAlias.has(k)) return false;
            return true;
          });
          if (toCreate.length) {
            const chunks: CustAcc[][] = [];
            for (let i = 0; i < toCreate.length; i += CHUNK) chunks.push(toCreate.slice(i, i + CHUNK));
            await runWithConcurrency(
              chunks.map((c) => async () => {
                const { data } = await supabase.from("customers")
                  .insert(c.map((x) => ({
                    organization_id: orgId, user_id: user.id,
                    name: x.name, phone: x.phone || null, email: x.email || null, document: x.document || null,
                  })))
                  .select("id, name, document");
                (data || []).forEach((rec: any, i: number) => {
                  c[i].keys.forEach((k) => customerIdByAlias.set(k, rec.id));
                  counters.customers++;
                });
              }),
              PARALLEL,
            );
          }
        }

        const resolveCustomerId = (r: ImportRow) => {
          if (r.customer_document && customerIdByAlias.has(r.customer_document)) return customerIdByAlias.get(r.customer_document)!;
          if (r.customer_name && customerIdByAlias.has(r.customer_name.toLowerCase())) return customerIdByAlias.get(r.customer_name.toLowerCase())!;
          return null;
        };

        // ───────────────────────────── 2) PRODUTOS (bulk)
        updateJob(jobId, { step: "products" });
        const productMap = new Map<string, { name: string; price?: number }>();
        for (const r of rows) {
          if (r.product_name) {
            const key = r.product_name.toLowerCase();
            if (!productMap.has(key)) productMap.set(key, { name: r.product_name, price: r.product_price ?? r.total_amount });
          }
        }
        const productIdByName = new Map<string, string>();
        if (productMap.size > 0) {
          const allP = Array.from(productMap.values());
          const { data: existingP } = await supabase
            .from("products").select("id, name").eq("organization_id", orgId).in("name", allP.map((p) => p.name));
          (existingP || []).forEach((p: any) => productIdByName.set(p.name.toLowerCase(), p.id));
          const toCreateP = allP.filter((p) => !productIdByName.has(p.name.toLowerCase()));
          if (toCreateP.length) {
            const chunks: typeof toCreateP[] = [];
            for (let i = 0; i < toCreateP.length; i += CHUNK) chunks.push(toCreateP.slice(i, i + CHUNK));
            await runWithConcurrency(
              chunks.map((c) => async () => {
                const { data } = await supabase.from("products")
                  .insert(c.map((p) => ({
                    organization_id: orgId, user_id: user.id, name: p.name,
                    price: p.price ?? 0, category: "Importado", active: true,
                  })))
                  .select("id, name");
                (data || []).forEach((rec: any) => {
                  productIdByName.set(rec.name.toLowerCase(), rec.id);
                  counters.products++;
                });
              }),
              PARALLEL,
            );
          }
        }

        // ───────────────────────────── 3) VENDAS (bulk + progresso por chunk)
        updateJob(jobId, { step: "sales" });
        const inserted: { id: string; row: ImportRow }[] = new Array(rows.length);
        const saleChunks: { offset: number; slice: ImportRow[] }[] = [];
        for (let i = 0; i < rows.length; i += CHUNK)
          saleChunks.push({ offset: i, slice: rows.slice(i, i + CHUNK) });

        await runWithConcurrency(
          saleChunks.map(({ offset, slice }) => async () => {
            const payload = slice.map((r) => ({
              user_id: user.id, organization_id: orgId,
              total_amount: r.total_amount, subtotal: r.total_amount,
              payment_method: r.payment_method, status: r.status,
              notes: r.notes, channel: "import",
              customer_id: resolveCustomerId(r),
              created_at: r.created_at,
            }));
            const { data, error } = await supabase.from("sales_orders").insert(payload).select("id");
            if (error) throw error;
            (data || []).forEach((s: any, i: number) => {
              inserted[offset + i] = { id: s.id, row: slice[i] };
              counters.sales++;
              counters.totalAmount += slice[i].total_amount;
            });
            updateJob(jobId, { processed: counters.sales });
          }),
          PARALLEL,
        );

        const ok = inserted.filter(Boolean);

        // ───────────────────────────── 4 + 5) ITENS + FINANCEIRO em paralelo
        updateJob(jobId, { step: "items" });
        const saleItems = ok
          .filter(({ row }) => row.product_name && productIdByName.has(row.product_name.toLowerCase()))
          .map(({ id, row }) => ({
            organization_id: orgId, sale_id: id,
            product_id: productIdByName.get(row.product_name!.toLowerCase())!,
            product_name: row.product_name!,
            quantity: row.product_quantity || 1,
            unit_price: row.product_price ?? row.total_amount,
            total: row.total_amount,
          }));
        const financeRows = ok
          .filter(({ row }) => row.status === "concluded")
          .map(({ id, row }) => ({
            organization_id: orgId, user_id: user.id, type: "income",
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
          runWithConcurrency(itemChunks.map((c) => async () => { await supabase.from("sale_items").insert(c); }), PARALLEL),
          runWithConcurrency(finChunks.map((c) => async () => {
            const { error } = await supabase.from("finance_transactions").insert(c);
            if (!error) counters.finance += c.length;
          }), PARALLEL),
        ]);

        updateJob(jobId, {
          status: "done", step: "done", finishedAt: Date.now(),
          processed: counters.sales, result: { ...counters },
        });
        toast.success(`Importação concluída · ${counters.sales} vendas em ${((Date.now() - (jobsRef.current.find((j) => j.id === jobId)?.startedAt ?? Date.now())) / 1000).toFixed(1)}s`);
      } catch (err: any) {
        updateJob(jobId, { status: "error", error: err.message || "Erro desconhecido", finishedAt: Date.now() });
        toast.error("Falha na importação: " + (err.message || "erro"));
      }
    },
    [user?.id, orgId, updateJob],
  );

  const startImport = useCallback(
    (fileName: string, rows: ImportRow[]) => {
      const id = crypto.randomUUID();
      const job: ImportJob = {
        id, fileName, startedAt: Date.now(),
        total: rows.length, processed: 0,
        status: "running", step: "preparing",
      };
      setJobs((prev) => [job, ...prev]);
      // dispara em background — não bloqueia a UI
      void runImport(id, rows);
      return id;
    },
    [runImport],
  );

  const clearFinished = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === "running"));
  }, []);

  const activeCount = jobs.filter((j) => j.status === "running").length;

  return (
    <ImportCtx.Provider value={{ jobs, activeCount, startImport, clearFinished }}>
      {children}
    </ImportCtx.Provider>
  );
}

export function useImport() {
  const ctx = useContext(ImportCtx);
  if (!ctx) throw new Error("useImport must be used inside <ImportProvider>");
  return ctx;
}
