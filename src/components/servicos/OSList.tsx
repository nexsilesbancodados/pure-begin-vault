import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  Loader2,
  FileDown,
  Trash2,
  Eye,
  Phone,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type OSRow = {
  id: string;
  status: string | null;
  problem_description: string | null;
  equipment: string | null;
  estimated_cost: number | null;
  created_at: string | null;
  customer_id: string;
  customer?: { name: string | null; phone: string | null } | null;
};

const statusStyles: Record<string, string> = {
  open: "bg-muted text-foreground/70 ring-border",
  in_progress: "bg-primary/10 text-primary ring-primary/20",
  waiting_approval: "bg-warning/10 text-warning ring-warning/20",
  approved: "bg-success/10 text-success ring-success/20",
  ready: "bg-success/10 text-success ring-success/20",
  delivered: "bg-[oklch(0.55_0.22_295)]/10 text-[oklch(0.55_0.22_295)] ring-[oklch(0.55_0.22_295)]/20",
  cancelled: "bg-destructive/10 text-destructive ring-destructive/20",
};

const statusDots: Record<string, string> = {
  open: "bg-muted-foreground",
  in_progress: "bg-primary animate-pulse",
  waiting_approval: "bg-warning animate-pulse",
  approved: "bg-success",
  ready: "bg-success",
  delivered: "bg-[oklch(0.55_0.22_295)]",
  cancelled: "bg-destructive",
};

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  waiting_approval: "Aguardando Aprovação",
  approved: "Aprovado",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function initialsFor(name?: string | null) {
  if (!name) return "—";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function OSList() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [rows, setRows] = useState<OSRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!user?.id || !orgId) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(
          "id,status,problem_description,equipment,estimated_cost,created_at,customer_id,customer:customers(name, phone)",
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) toast.error("Erro ao carregar OS: " + error.message);
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, [user?.id, orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && (r.status || "open") !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.customer?.name ?? "").toLowerCase().includes(q) ||
        (r.equipment ?? "").toLowerCase().includes(q) ||
        (r.problem_description ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      open: rows.filter((r) => r.status === "open").length,
      progress: rows.filter((r) => r.status === "in_progress").length,
      done: rows.filter((r) => r.status === "delivered" || r.status === "ready").length,
    }),
    [rows],
  );

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("service_orders")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
      toast.success(`Status atualizado para ${statusLabels[newStatus]}`);
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleDeleteOS = async (id: string) => {
    if (!window.confirm("Deseja excluir esta Ordem de Serviço?")) return;
    try {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast.success("OS excluída com sucesso");
    } catch (error) {
      toast.error("Erro ao excluir OS");
    }
  };

  const handlePrintTerm = (os: OSRow) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const content = `
         <html>
           <head>
             <title>Termo de Recebimento - OS ${os.id.slice(0, 8)}</title>
             <style>
               body { font-family: sans-serif; padding: 20px; line-height: 1.6; }
               .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
               .info { margin-bottom: 15px; }
               .footer { margin-top: 50px; text-align: center; }
               .signature { margin-top: 30px; border-top: 1px solid #000; width: 300px; margin-left: auto; margin-right: auto; }
             </style>
           </head>
           <body>
             <div class="header">
               <h1>TERMO DE RECEBIMENTO</h1>
               <p>OS #${os.id.slice(0, 8)} - Data: ${new Date().toLocaleDateString("pt-BR")}</p>
             </div>
             <div class="info"><strong>Cliente:</strong> ${os.customer?.name || "---"}</div>
             <div class="info"><strong>Aparelho:</strong> ${os.equipment || "---"}</div>
             <div class="info"><strong>Problema Relatado:</strong> ${os.problem_description || "---"}</div>
             <div class="info"><strong>Orçamento Estimado:</strong> R$ ${(os.estimated_cost || 0).toFixed(2)}</div>
             <div style="margin-top: 30px;">
               <p>Declaro estar ciente dos termos de serviço e autorizo a análise técnica do equipamento acima descrito.</p>
             </div>
             <div class="footer">
               <div class="signature"></div>
               <p>Assinatura do Cliente</p>
             </div>
           </body>
         </html>`;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const filterChips = [
    { key: "all", label: "Todas", count: stats.total },
    { key: "open", label: "Abertas", count: stats.open },
    { key: "in_progress", label: "Em Andamento", count: stats.progress },
    { key: "ready", label: "Prontas", count: rows.filter((r) => r.status === "ready").length },
    { key: "delivered", label: "Entregues", count: rows.filter((r) => r.status === "delivered").length },
  ];

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Wrench, tone: "primary" },
          { label: "Em Aberto", value: stats.open, icon: AlertCircle, tone: "warning" },
          { label: "Em Andamento", value: stats.progress, icon: Clock, tone: "info" },
          { label: "Concluídas", value: stats.done, icon: CheckCircle2, tone: "success" },
        ].map((s) => (
          <div
            key={s.label}
            className="group relative overflow-hidden rounded-2xl bg-card border border-border p-4 shadow-card transition-all hover:shadow-elegant hover:-translate-y-0.5"
          >
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-50 transition-opacity group-hover:opacity-80",
                s.tone === "primary" && "bg-primary/30",
                s.tone === "warning" && "bg-warning/30",
                s.tone === "info" && "bg-info/30",
                s.tone === "success" && "bg-success/30",
              )}
            />
            <div className="relative flex items-center gap-3">
              <div
                className={cn(
                  "h-11 w-11 rounded-xl grid place-items-center ring-1 ring-inset",
                  s.tone === "primary" && "bg-primary/10 text-primary ring-primary/20",
                  s.tone === "warning" && "bg-warning/10 text-warning ring-warning/20",
                  s.tone === "info" && "bg-info/10 text-info ring-info/20",
                  s.tone === "success" && "bg-success/10 text-success ring-success/20",
                )}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-2xl font-black tracking-tight font-display">{s.value}</div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                  {s.label}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Buscar OS, cliente ou aparelho..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
            />
          </div>
          <button className="h-10 px-4 rounded-xl border border-border bg-card flex items-center gap-2 text-sm font-medium hover:bg-muted transition shrink-0">
            <Filter className="h-4 w-4" /> Filtros
          </button>
        </div>
        <a
          href="/servicos/nova"
          className="h-10 px-5 rounded-xl bg-gradient-primary text-white flex items-center gap-2 text-sm font-bold shadow-blue hover:opacity-95 hover:scale-[1.02] active:scale-95 transition shrink-0"
        >
          <Plus className="h-4 w-4" /> Nova OS
        </a>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {filterChips.map((c) => (
          <button
            key={c.key}
            onClick={() => setStatusFilter(c.key)}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-bold inline-flex items-center gap-2 ring-1 ring-inset transition",
              statusFilter === c.key
                ? "bg-primary text-primary-foreground ring-primary shadow-blue"
                : "bg-card text-foreground/70 ring-border hover:bg-muted",
            )}
          >
            {c.label}
            <span
              className={cn(
                "px-1.5 py-px rounded-full text-[10px] tabular-nums",
                statusFilter === c.key ? "bg-white/20" : "bg-muted",
              )}
            >
              {c.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["OS", "Cliente / Aparelho", "Problema", "Status", "Valor", "Data", ""].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((os) => {
                const status = os.status || "open";
                return (
                  <tr key={os.id} className="group hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono text-[11px] font-black text-primary bg-primary/5 px-2 py-1 rounded-md ring-1 ring-inset ring-primary/15">
                        #{os.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-primary text-white grid place-items-center text-[11px] font-black shrink-0 shadow-sm">
                          {initialsFor(os.customer?.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">
                            {os.customer?.name ?? "—"}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                            <Wrench className="h-3 w-3 shrink-0" />
                            {os.equipment ?? "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground max-w-xs">
                      <p className="line-clamp-2">{os.problem_description ?? "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ring-1 ring-inset",
                          statusStyles[status],
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusDots[status])} />
                        {statusLabels[status] || "Aberto"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-foreground tabular-nums">
                      {(os.estimated_cost ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground tabular-nums">
                      {os.created_at
                        ? new Date(os.created_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {os.customer?.phone && (
                          <a
                            href={`https://wa.me/55${os.customer.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-lg hover:bg-success/10 text-success transition"
                            title="WhatsApp"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        <a
                          href={`/os-track/${os.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg hover:bg-primary/10 text-primary transition"
                          title="Acompanhar"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 rounded-lg hover:bg-muted transition">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="gap-2">
                                <Clock className="h-4 w-4" /> Alterar Status
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                  {Object.entries(statusLabels).map(([key, label]) => (
                                    <DropdownMenuItem
                                      key={key}
                                      onClick={() => handleUpdateStatus(os.id, key)}
                                    >
                                      <span
                                        className={cn(
                                          "h-2 w-2 rounded-full mr-2",
                                          statusDots[key],
                                        )}
                                      />
                                      {label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>
                            <DropdownMenuItem
                              onClick={() => handlePrintTerm(os)}
                              className="gap-2"
                            >
                              <FileDown className="h-4 w-4" /> Imprimir Termo
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteOS(os.id)}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" /> Excluir OS
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="p-12 grid place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="p-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto mb-4 ring-1 ring-inset ring-primary/20">
              <Wrench className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black font-display">Nenhuma OS encontrada</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Comece criando sua primeira ordem de serviço para acompanhar reparos e entregas.
            </p>
            <a
              href="/servicos/nova"
              className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-primary text-white text-sm font-bold shadow-blue hover:opacity-95 transition"
            >
              <Plus className="h-4 w-4" /> Abrir Primeira OS
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
