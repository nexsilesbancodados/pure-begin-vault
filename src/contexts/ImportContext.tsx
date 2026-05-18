import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

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
  status: "queued" | "running" | "done" | "error";
  step: "preparing" | "customers" | "products" | "sales" | "items" | "finance" | "done";
  result?: { sales: number; customers: number; products: number; finance: number; totalAmount: number };
  error?: string;
};

type Ctx = {
  jobs: ImportJob[];
  activeCount: number;
  startImport: (fileName: string, rows: ImportRow[]) => Promise<string | null>;
  clearFinished: () => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
};

const ImportCtx = createContext<Ctx | null>(null);

function mapRow(r: any): ImportJob {
  return {
    id: r.id,
    fileName: r.file_name,
    startedAt: new Date(r.started_at ?? r.created_at).getTime(),
    finishedAt: r.finished_at ? new Date(r.finished_at).getTime() : undefined,
    total: r.total ?? 0,
    processed: r.processed ?? 0,
    status: r.status,
    step: r.step,
    result: r.result ?? undefined,
    error: r.error ?? undefined,
  };
}

export function ImportProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [jobs, setJobs] = useState<ImportJob[]>([]);

  // Carrega + assina realtime por organização
  useEffect(() => {
    if (!orgId) { setJobs([]); return; }
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("import_jobs")
        .select("id,file_name,status,step,total,processed,result,error,started_at,finished_at,created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) setJobs((data || []).map(mapRow));
    })();

    const ch = supabase
      .channel(`import_jobs:${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "import_jobs", filter: `organization_id=eq.${orgId}` },
        (payload) => {
          setJobs((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((j) => j.id !== (payload.old as any).id);
            }
            const row = mapRow(payload.new);
            const idx = prev.findIndex((j) => j.id === row.id);
            if (idx === -1) return [row, ...prev];
            const next = [...prev];
            const prevStatus = next[idx].status;
            next[idx] = row;
            if (prevStatus === "running" && row.status === "done") {
              toast.success(`Importação concluída · ${row.result?.sales ?? row.processed} vendas`);
            } else if (prevStatus !== "error" && row.status === "error") {
              toast.error("Falha na importação: " + (row.error || "erro"));
            }
            return next;
          });
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [orgId]);

  const startImport = useCallback(
    async (fileName: string, rows: ImportRow[]) => {
      if (!user?.id || !orgId) {
        toast.error("Faça login para importar");
        return null;
      }
      const { data, error } = await supabase
        .from("import_jobs")
        .insert({
          organization_id: orgId,
          user_id: user.id,
          file_name: fileName,
          total: rows.length,
          status: "queued",
          step: "preparing",
          payload: rows,
        })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Não foi possível enfileirar: " + (error?.message || "erro"));
        return null;
      }
      // dispara o processador em background no servidor
      const { error: invErr } = await supabase.functions.invoke("process-import-job", {
        body: { jobId: data.id },
      });
      if (invErr) toast.error("Falha ao iniciar processamento: " + invErr.message);
      else toast.success("Importação iniciada em segundo plano");
      return data.id;
    },
    [user?.id, orgId],
  );

  const clearFinished = useCallback(async () => {
    if (!orgId) return;
    await supabase
      .from("import_jobs")
      .delete()
      .eq("organization_id", orgId)
      .in("status", ["done", "error"]);
  }, [orgId]);

  const deleteJob = useCallback(async (jobId: string) => {
    const { error } = await supabase.from("import_jobs").delete().eq("id", jobId);
    if (error) toast.error("Falha ao remover: " + error.message);
    else toast.success("Importação removida");
  }, []);

  const activeCount = useMemo(
    () => jobs.filter((j) => j.status === "running" || j.status === "queued").length,
    [jobs],
  );

  return (
    <ImportCtx.Provider value={{ jobs, activeCount, startImport, clearFinished, deleteJob }}>
      {children}
    </ImportCtx.Provider>
  );
}

export function useImport() {
  const ctx = useContext(ImportCtx);
  if (!ctx) throw new Error("useImport must be used inside <ImportProvider>");
  return ctx;
}
