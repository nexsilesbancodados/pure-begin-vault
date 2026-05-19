import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useImport, type ImportJob } from "@/contexts/ImportContext";
import { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  FileSpreadsheet,
  Clock,
  TrendingUp,
  Upload,
  Sparkles,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImportModal } from "@/components/import/ImportModal";
import { JobDetailModal } from "@/components/import/JobDetailModal";

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

type FilterKey = "all" | "running" | "done" | "error";

function ImportPage() {
  const { jobs, activeCount, clearFinished, deleteJob } = useImport();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => ({
    all: jobs.length,
    running: jobs.filter((j) => j.status === "running").length,
    done: jobs.filter((j) => j.status === "done").length,
    error: jobs.filter((j) => j.status === "error").length,
  }), [jobs]);

  const totals = useMemo(() => {
    const finished = jobs.filter((j) => j.result);
    return {
      sales: finished.reduce((s, j) => s + (j.result?.sales ?? 0), 0),
      amount: finished.reduce((s, j) => s + (j.result?.totalAmount ?? 0), 0),
    };
  }, [jobs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (filter !== "all" && j.status !== filter) return false;
      if (q && !j.fileName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, filter, query]);

  const done = jobs.filter((j) => j.status !== "running");

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Importações" subtitle="Acompanhe os carregamentos em segundo plano" toggleSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* HERO */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-info/5 to-transparent p-6 sm:p-7">
            <div
              aria-hidden
              className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-info/15 blur-3xl"
            />
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
                  <Sparkles className="h-3 w-3" /> Processamento em segundo plano
                </div>
                <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight">
                  Importações <span className="text-primary">em tempo real</span>
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
                  Suba planilhas e continue trabalhando — tudo é processado no servidor e sincroniza entre lojas e logins.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <div className="hidden sm:flex flex-col items-end justify-center text-right pr-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total importado</p>
                  <p className="text-lg font-black tabular-nums">{brl(totals.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">{totals.sales.toLocaleString("pt-BR")} vendas</p>
                </div>
                <Button
                  size="lg"
                  onClick={() => setModalOpen(true)}
                  className="rounded-xl gap-2 bg-gradient-to-r from-primary to-info hover:opacity-90 shadow-lg shadow-primary/25"
                >
                  <Upload className="h-4 w-4" /> Nova importação
                </Button>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard label="Em andamento" value={counts.running} color="info" icon={<Loader2 className={`h-4 w-4 ${counts.running > 0 ? "animate-spin" : ""}`} />} />
            <KpiCard label="Concluídas" value={counts.done} color="success" icon={<CheckCircle2 className="h-4 w-4" />} />
            <KpiCard label="Com erro" value={counts.error} color="destructive" icon={<AlertCircle className="h-4 w-4" />} />
            <KpiCard label="Total na sessão" value={counts.all} color="primary" icon={<FileSpreadsheet className="h-4 w-4" />} />
          </div>

          {/* Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome do arquivo…"
                className="pl-9 rounded-xl h-10 bg-card"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl p-1">
              <Filter className="h-3.5 w-3.5 text-muted-foreground ml-2 mr-0.5" />
              {(["all", "running", "done", "error"] as FilterKey[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`text-[11px] font-black uppercase tracking-wider px-3 h-7 rounded-lg transition-colors ${
                    filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {k === "all" ? "Todas" : k === "running" ? "Ativas" : k === "done" ? "Concluídas" : "Erros"}
                  <span className="ml-1 opacity-70">{counts[k]}</span>
                </button>
              ))}
            </div>
            {activeCount > 0 && (
              <span className="inline-flex items-center gap-2 text-[11px] font-bold text-info bg-info/10 border border-info/30 rounded-full px-3 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-info opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
                </span>
                {activeCount} em processamento
              </span>
            )}
            {done.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFinished} className="rounded-lg text-xs gap-1.5 ml-auto">
                <Trash2 className="h-3.5 w-3.5" /> Limpar finalizadas
              </Button>
            )}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/50 p-16 text-center">
              <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-info/10 flex items-center justify-center mb-5 border border-primary/20">
                <FileSpreadsheet className="h-9 w-9 text-primary" />
              </div>
              <h3 className="text-lg font-black">
                {jobs.length === 0 ? "Nenhuma importação ainda" : "Nenhum resultado nesta visão"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                {jobs.length === 0
                  ? "Suba uma planilha de vendas para começar — o processamento roda em segundo plano e fica disponível em todas as suas lojas."
                  : "Ajuste o filtro ou o termo de busca para ver outros jobs desta sessão."}
              </p>
              {jobs.length === 0 ? (
                <Button
                  onClick={() => setModalOpen(true)}
                  className="mt-5 rounded-xl gap-2 bg-gradient-to-r from-primary to-info"
                >
                  <Upload className="h-4 w-4" /> Iniciar primeira importação
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => { setFilter("all"); setQuery(""); }}
                  className="mt-5 rounded-xl gap-2"
                >
                  <RefreshCw className="h-4 w-4" /> Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((j) => (
                <JobCard 
                  key={j.id} 
                  job={j} 
                  onDelete={deleteJob} 
                  onClick={() => {
                    setSelectedJob(j);
                    setDetailModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <ImportModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onImportSuccess={() => setModalOpen(false)}
      />
    </div>
  );
}

function KpiCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const tone: Record<string, string> = {
    info: "from-info/10 to-transparent border-info/20 text-info",
    success: "from-success/10 to-transparent border-success/20 text-success",
    destructive: "from-destructive/10 to-transparent border-destructive/20 text-destructive",
    primary: "from-primary/10 to-transparent border-primary/20 text-primary",
  };
  return (
    <div className={`rounded-2xl p-4 bg-gradient-to-br border ${tone[color]} transition-transform hover:-translate-y-0.5`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider">
        {icon} {label}
      </div>
      <p className="text-3xl font-black mt-2 text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function JobCard({ job, onDelete }: { job: ImportJob; onDelete: (id: string) => void | Promise<void> }) {
  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  const statusTone =
    job.status === "running" ? "bg-info/10 text-info border-info/30"
    : job.status === "done" ? "bg-success/10 text-success border-success/30"
    : "bg-destructive/10 text-destructive border-destructive/30";

  const stripe =
    job.status === "error" ? "bg-destructive"
    : job.status === "done" ? "bg-success"
    : "bg-gradient-to-b from-info to-primary";

  const handleDelete = () => {
    const isActive = job.status === "running" || job.status === "queued";
    const msg = isActive
      ? `"${job.fileName}" ainda está em processamento. Remover mesmo assim?`
      : `Remover "${job.fileName}"? Esta ação não pode ser desfeita.`;
    if (confirm(msg)) onDelete(job.id);
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex shadow-sm hover:shadow-md transition-shadow group">
      <div className={`w-1 shrink-0 ${stripe}`} />
      <div className="flex-1 min-w-0">
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
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtElapsed(job)}</span>
              <span>{job.processed}/{job.total} vendas</span>
              {job.result && (
                <span className="flex items-center gap-1 text-success font-bold">
                  <TrendingUp className="h-3 w-3" /> {brl(job.result.totalAmount)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-2xl font-black tabular-nums">{pct}%</p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              title="Remover importação"
              aria-label="Remover importação"
              className="h-9 w-9 rounded-xl border border-border bg-background/60 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 flex items-center justify-center transition-colors opacity-70 group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card p-2.5 text-center">
      <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-black mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
