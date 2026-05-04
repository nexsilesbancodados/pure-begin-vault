import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Search, Plus, MoreHorizontal, MessageSquare, Instagram, Trash2, Pencil, Phone, Loader2, Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PipelineTabs } from "@/components/pipeline/PipelineTabs";

type Lead = {
  id: string;
  name: string;
   email: string | null;
   phone: string | null;
   source: string | null;
   status: string | null;
   created_at: string;
   whatsapp_tags?: string[];
   avatar_url?: string | null;
 };

const STATUS = [
  { value: "new", label: "Novo", className: "bg-primary/10 text-primary border-primary/20" },
  { value: "contacted", label: "Em contato", className: "bg-info/10 text-info border-info/20" },
  { value: "qualified", label: "Qualificado", className: "bg-warning/10 text-warning border-warning/20" },
  { value: "won", label: "Ganho", className: "bg-success/10 text-success border-success/20" },
  { value: "lost", label: "Perdido", className: "bg-destructive/10 text-destructive border-destructive/20" },
];

export function LeadsTable() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Lead> | null>(null);
  const [saving, setSaving] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickLead, setQuickLead] = useState({ name: "", phone: "" });

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "all" && (l.status ?? "new") !== statusFilter) return false;
      if (!term) return true;
      return [l.name, l.email, l.phone].some((f) => (f ?? "").toLowerCase().includes(term));
    });
  }, [leads, search, statusFilter]);

  const save = async () => {
    if (!user?.id || !editing) return;
    if (!editing.name?.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      email: editing.email?.trim() || null,
      phone: editing.phone?.trim() || null,
      source: editing.source || "manual",
      status: editing.status || "new",
      user_id: user.id,
    };
    const { error } = editing.id
      ? await supabase.from("leads").update(payload).eq("id", editing.id)
      : await supabase.from("leads").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Lead atualizado" : "Lead criado");
    setEditing(null);
    load();
  };

  const handleQuickSave = async () => {
    if (!user?.id) return;
    if (!quickLead.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload = {
      name: quickLead.name.trim(),
      phone: quickLead.phone.trim() || null,
      source: "manual",
      status: "new",
      user_id: user.id,
    };
    const { error } = await supabase.from("leads").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Lead cadastrado com sucesso!");
    setQuickLead({ name: "", phone: "" });
    setIsQuickAddOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este lead?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  };

  const exportCsv = () => {
    const headers = ["Nome", "Email", "Telefone", "Origem", "Status", "Criado em"];
    const rows = filtered.map((l) => [l.name, l.email ?? "", l.phone ?? "", l.source ?? "", l.status ?? "", new Date(l.created_at).toLocaleString("pt-BR")]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s: string | null) => {
    const cfg = STATUS.find((x) => x.value === (s ?? "new")) ?? STATUS[0];
    return <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${cfg.className}`}>{cfg.label}</span>;
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Pipeline de Vendas" subtitle="Gerencie leads e oportunidades em um só lugar" />
        <main className="flex-1 overflow-y-auto p-6">
          <PipelineTabs />

          {/* Quick Add Section */}
          <div className={`mb-6 transition-all duration-300 overflow-hidden ${isQuickAddOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                  <Plus className="h-4 w-4" /> Cadastro Rápido de Lead
                </h3>
                <button onClick={() => setIsQuickAddOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nome Completo</Label>
                  <Input 
                    placeholder="Nome do lead..." 
                    value={quickLead.name}
                    onChange={(e) => setQuickLead({...quickLead, name: e.target.value})}
                    className="bg-card h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">WhatsApp / Telefone</Label>
                  <Input 
                    placeholder="55..." 
                    value={quickLead.phone}
                    onChange={(e) => setQuickLead({...quickLead, phone: e.target.value})}
                    className="bg-card h-11"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleQuickSave} disabled={saving} className="flex-1 h-11 font-bold">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Cadastrar Lead
                  </Button>
                  <Button variant="outline" onClick={() => setEditing({})} className="h-11 px-4">
                    Formulário Completo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
            <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative max-w-sm w-full">
                  <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    placeholder="Buscar por nome, telefone ou email..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/50 border border-transparent focus:bg-card focus:border-primary/30 outline-none text-sm transition"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={exportCsv} className="gap-2">
                  <Download className="h-4 w-4" /> Exportar
                </Button>
                <Button onClick={() => setIsQuickAddOpen(!isQuickAddOpen)} className={`gap-2 ${isQuickAddOpen ? "bg-muted text-foreground hover:bg-muted/80" : ""}`}>
                  <Plus className="h-4 w-4" strokeWidth={3} /> Novo Lead
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">Nome / Contato</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">Canal</th>
                     <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">Tags</th>
                     <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">Status</th>
                     <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={5} className="p-12 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="p-12 text-center text-sm text-muted-foreground">
                      Nenhum lead encontrado. <button onClick={() => setEditing({})} className="text-primary font-bold hover:underline">Cadastre o primeiro</button>.
                    </td></tr>
                  ) : filtered.map((lead) => (
                    <tr key={lead.id} className="hover:bg-muted/20 transition group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-xl bg-gradient-primary text-white grid place-items-center font-bold text-sm overflow-hidden">
                             {lead.avatar_url ? (
                               <img src={lead.avatar_url} className="w-full h-full object-cover" alt="" />
                             ) : (
                               lead.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                             )}
                           </div>
                          <div>
                            <div className="text-sm font-bold group-hover:text-primary transition">{lead.name}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">{lead.phone || lead.email || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {lead.source === "instagram" ? (
                            <div className="h-7 w-7 rounded-lg bg-pink-500/10 grid place-items-center"><Instagram className="h-3.5 w-3.5 text-pink-500" /></div>
                          ) : (
                            <div className="h-7 w-7 rounded-lg bg-success/10 grid place-items-center"><MessageSquare className="h-3.5 w-3.5 text-success" /></div>
                          )}
                          <span className="text-xs font-medium capitalize">{lead.source || "manual"}</span>
                        </div>
                      </td>
                       <td className="px-6 py-4">
                         <div className="flex flex-wrap gap-1">
                           {lead.whatsapp_tags?.map((tag, i) => (
                             <span key={i} className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black uppercase">
                               {tag}
                             </span>
                           ))}
                           {(!lead.whatsapp_tags || lead.whatsapp_tags.length === 0) && <span className="text-muted-foreground/30">—</span>}
                         </div>
                       </td>
                       <td className="px-6 py-4">{statusBadge(lead.status)}</td>
                       <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {lead.phone && (
                            <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="h-8 w-8 grid place-items-center rounded-lg hover:bg-success/10 hover:text-success transition text-muted-foreground"><MessageSquare className="h-4 w-4" /></a>
                          )}
                          <button onClick={() => setEditing(lead)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-primary/10 hover:text-primary transition text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => remove(lead.id)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive transition text-muted-foreground"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-border flex items-center justify-between bg-muted/10">
              <div className="text-xs text-muted-foreground">
                Exibindo <span className="font-bold text-foreground">{filtered.length}</span> de <span className="font-bold text-foreground">{leads.length}</span> leads
              </div>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Lead" : "Novo Lead"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={editing?.name ?? ""} onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={editing?.phone ?? ""} onChange={(e) => setEditing((p) => ({ ...p, phone: e.target.value }))} placeholder="5511999999999" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={editing?.email ?? ""} onChange={(e) => setEditing((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Origem</Label>
                <Select value={editing?.source ?? "manual"} onValueChange={(v) => setEditing((p) => ({ ...p, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="bot">Bot</SelectItem>
                    <SelectItem value="indicacao">Indicação</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing?.status ?? "new"} onValueChange={(v) => setEditing((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}