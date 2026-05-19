import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Users,
  Package,
  DollarSign,
  Calendar,
  Zap,
  Eye,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportJob } from "@/contexts/ImportContext";

interface JobDetailModalProps {
  job: ImportJob | null;
  isOpen: boolean;
  onClose: () => void;
}

const STEP_LABEL: Record<ImportJob["step"], string> = {
  preparing: "Preparando",
  customers: "Sincronizando clientes",
  products: "Sincronizando produtos",
  sales: "Gravando vendas",
  items: "Lançando itens",
  finance: "Atualizando financeiro",
  done: "Finalizado",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function JobDetailModal({ job, isOpen, onClose }: JobDetailModalProps) {
  if (!job) return null;

  const duration = job.finishedAt
    ? ((job.finishedAt - job.startedAt) / 1000).toFixed(1) + "s"
    : "Em andamento...";

  const pct = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden rounded-3xl border-border">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-br from-primary/10 via-info/5 to-transparent border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/20">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-black truncate">{job.fileName}</DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5 flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                Criado em {new Date(job.startedAt).toLocaleString("pt-BR")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Status & Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {job.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-info" />
                ) : job.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-black uppercase tracking-wider">
                  {job.status === "running" ? STEP_LABEL[job.step] : job.status === "done" ? "Processamento Concluído" : "Erro no Processamento"}
                </span>
              </div>
              <span className="text-sm font-black tabular-nums">{pct}%</span>
            </div>
            
            <div className="h-3 bg-muted/40 rounded-full overflow-hidden border border-border/50">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  job.status === "error" ? "bg-destructive" : job.status === "done" ? "bg-success" : "bg-gradient-to-r from-info to-primary animate-pulse"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-center gap-4 text-[11px] font-bold text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-md border border-border/40">
                <Clock className="h-3 w-3" />
                <span>Duração: {duration}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-1 rounded-md border border-border/40">
                <Zap className="h-3 w-3" />
                <span>Processado: {job.processed} / {job.total} registros</span>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          {job.result && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <ResultCard 
                label="Total faturado" 
                value={brl(job.result.totalAmount)} 
                subValue={`${job.result.sales} vendas`}
                icon={<TrendingUp className="h-4 w-4" />}
                color="primary"
              />
              <ResultCard 
                label="Novos Clientes" 
                value={job.result.customers} 
                subValue="Cadastrados ou vinculados"
                icon={<Users className="h-4 w-4" />}
                color="info"
              />
              <ResultCard 
                label="Produtos" 
                value={job.result.products} 
                subValue="Itens processados"
                icon={<Package className="h-4 w-4" />}
                color="success"
              />
              <ResultCard 
                label="Lançamentos" 
                value={job.result.finance} 
                subValue="Contas a receber/pagar"
                icon={<DollarSign className="h-4 w-4" />}
                color="warning"
              />
            </div>
          )}

          {/* Error Message */}
          {job.error && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 text-destructive font-black text-xs uppercase tracking-wider mb-2">
                <AlertCircle className="h-3.5 w-3.5" /> Detalhes do Erro
              </div>
              <p className="text-sm text-destructive leading-relaxed">
                {job.error}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
          <Button onClick={onClose} variant="outline" className="rounded-xl px-8">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResultCard({ label, value, subValue, icon, color }: { 
  label: string; 
  value: string | number; 
  subValue: string;
  icon: React.ReactNode;
  color: "primary" | "info" | "success" | "warning";
}) {
  const tones = {
    primary: "from-primary/10 border-primary/20 text-primary",
    info: "from-info/10 border-info/20 text-info",
    success: "from-success/10 border-success/20 text-success",
    warning: "from-amber-500/10 border-amber-500/20 text-amber-600",
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[color]} p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-80">
        {icon} {label}
      </div>
      <div className="text-xl font-black tracking-tight text-foreground">{value}</div>
      <div className="text-[10px] font-bold text-muted-foreground">{subValue}</div>
    </div>
  );
}
