import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useImport, type ImportJob } from "@/contexts/ImportContext";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Trash2, FileSpreadsheet, Clock, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/importacao")({
  head: () => ({ meta: [{ title: "Importações — ConectaCRM" }] }),
  component: ImportPage,
});

const STEP_LABEL: Record<ImportJob["step"], string> = {
  preparing: "Preparando",
  customers: "Sincronizando clientes",
  products: "Sincronizando produtos",
  sales: "Gravando vendas",
  items: "Lançando itens",
  finance: "Atualizando financeiro",
  done: "Finalizado",
};

function fmtElapsed(j: ImportJob) {
  const end = j.finishedAt ?? Date.now();
  const s = ((end - j.startedAt) / 1000).toFixed(1);
  return `${s}s`;
}
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ImportPage() {
  const { jobs, activeCount, clearFinished } = useImport();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const done = jobs.filter((j) => j.status !== "running");

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Importações" subtitle="Acompanhe os carregamentos em segundo plano" toggleSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="Em andamento" value={activeCount} color="info" icon={<Loader2 className={`h-4 w-4 ${activeCount > 0 ? "animate-spin" : ""}`} />} />
            <KpiCard label="Concluídas" value={jobs.filter((j) => j.status === "done").length} color="success" icon={<CheckCircle2 className="h-4 w-4" />} />
            <KpiCard label="Com erro" value={jobs.filter((j) => j.status === "error").length} color="destructive" icon={<AlertCircle className="h-4 w-4" />} />
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground">Histórico desta sessão</h2>
            {done.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFinished} className="rounded-lg text-xs gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Limpar finalizadas
              </Button>
            )}
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-16 text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-black">Nenhuma importação ativa</h3>
              <p className="text-sm text-muted-foreground mt-1">Inicie uma importação no Histórico de Vendas para acompanhar aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((j) => <JobCard key={j.id} job={j} />)}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const tone: Record<string, string> = {
    info: "from-info/10 to-transparent border-info/20 text-info",
    success: "from-success/10 to-transparent border-success/20 text-success",
    destructive: "from-destructive/10 to-transparent border-destructive/20 text-destructive",
  };
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br border ${tone[color]}`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
        {icon} {label}
      </div>
      <p className="text-3xl font-black mt-2 text-foreground">{value}</p>
    </div>
  );
}

function JobCard({ job }: { job: ImportJob }) {
  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  const statusTone =
    job.status === "running" ? "bg-info/10 text-info border-info/30"
    : job.status === "done" ? "bg-success/10 text-success border-success/30"
    : "bg-destructive/10 text-destructive border-destructive/30";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {job.status === "running" ? <Loader2 className="h-5 w-5 animate-spin" /> : job.status === "done" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-sm truncate">{job.fileName}</p>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${statusTone}`}>
              {job.status === "running" ? STEP_LABEL[job.step] : job.status === "done" ? "Concluída" : "Erro"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtElapsed(job)}</span>
            <span>{job.processed}/{job.total} vendas</span>
            {job.result && (
              <span className="flex items-center gap-1 text-success font-bold">
                <TrendingUp className="h-3 w-3" /> {brl(job.result.totalAmount)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black tabular-nums">{pct}%</p>
        </div>
      </div>

      <div className="h-1.5 bg-muted/40">
        <div
          className={`h-full transition-all duration-300 ${job.status === "error" ? "bg-destructive" : job.status === "done" ? "bg-success" : "bg-gradient-to-r from-info to-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {job.result && (
        <div className="grid grid-cols-4 gap-px bg-border/50 border-t border-border">
          <Stat label="Vendas" value={job.result.sales} />
          <Stat label="Clientes" value={job.result.customers} />
          <Stat label="Produtos" value={job.result.products} />
          <Stat label="Financeiro" value={job.result.finance} />
        </div>
      )}

      {job.error && (
        <div className="px-4 py-2.5 border-t border-destructive/20 bg-destructive/5 text-[11px] text-destructive font-medium">
          {job.error}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card p-2.5 text-center">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-black mt-0.5">{value}</p>
    </div>
  );
}
