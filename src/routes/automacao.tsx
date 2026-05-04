import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, Plus, Play, Pause, Trash2, Sparkles, MessageSquare, Bot, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/automacao")({
  head: () => ({ meta: [{ title: "Automações — ConectaCRM" }, { name: "description", content: "Fluxos automáticos de atendimento e CRM." }] }),
  component: AutomationPage,
});

type Automation = {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  is_active: boolean;
  config: any;
  created_at: string;
};

const TRIGGERS = [
  { value: "new_lead", label: "Novo lead criado" },
  { value: "message_received", label: "Mensagem recebida" },
  { value: "stage_changed", label: "Lead muda de etapa do funil" },
  { value: "no_reply_24h", label: "Sem resposta há 24h" },
];

const ACTIONS = [
  { value: "send_message", label: "Enviar mensagem WhatsApp" },
  { value: "send_email", label: "Enviar E-mail (Resend)" },
  { value: "create_task", label: "Criar tarefa" },
  { value: "move_pipeline", label: "Mover no funil" },
  { value: "notify_team", label: "Notificar equipe" },
];

function AutomationPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger_type: "new_lead",
    action_type: "send_message",
    message: "",
    subject: "",
    email_body: "",
  });

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("automations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!user?.id || !form.name.trim()) return toast.error("Dê um nome ao fluxo");
    const { error } = await supabase.from("automations").insert({
      user_id: user.id,
      name: form.name,
      trigger_type: form.trigger_type,
      action_type: form.action_type,
      config: { 
        message: form.message,
        subject: form.subject,
        email_body: form.email_body 
      },
      is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Automação criada!");
    setOpen(false);
    setForm({ 
      name: "", 
      trigger_type: "new_lead", 
      action_type: "send_message", 
      message: "", 
      subject: "", 
      email_body: "" 
    });
    load();
  };

  const toggle = async (a: Automation) => {
    await supabase.from("automations").update({ is_active: !a.is_active }).eq("id", a.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta automação?")) return;
    await supabase.from("automations").delete().eq("id", id);
    load();
  };

  const stats = {
    total: items.length,
    active: items.filter((i) => i.is_active).length,
    paused: items.filter((i) => !i.is_active).length,
  };

  const triggerLabel = (t: string) => TRIGGERS.find((x) => x.value === t)?.label ?? t;
  const actionLabel = (t: string) => ACTIONS.find((x) => x.value === t)?.label ?? t;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Automações" subtitle="Crie fluxos de atendimento automáticos" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="rounded-2xl bg-gradient-sidebar-cta p-8 text-white shadow-elegant relative overflow-hidden mb-8">
            <div className="absolute top-0 right-0 p-12 opacity-10"><Zap className="h-40 w-40" /></div>
            <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80 mb-3">
                <Sparkles className="h-4 w-4" /> Automação inteligente
              </div>
              <h2 className="text-3xl font-bold font-display mb-4">Venda mais com menos esforço</h2>
              <p className="text-white/85 text-lg mb-6 leading-relaxed">
                Configure gatilhos que disparam mensagens, criam tarefas e movem leads no funil automaticamente.
              </p>
              <Button onClick={() => setOpen(true)} className="h-11 px-6 rounded-xl bg-white text-primary font-bold hover:bg-white/90 gap-2">
                <Plus className="h-5 w-5" strokeWidth={3} /> Criar Novo Fluxo
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Total", value: stats.total, icon: Zap, color: "text-primary" },
              { label: "Ativas", value: stats.active, icon: Play, color: "text-success" },
              { label: "Pausadas", value: stats.paused, icon: Pause, color: "text-warning" },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-card">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-8 w-8 rounded-lg bg-muted grid place-items-center ${s.color}`}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</span>
                </div>
                <div className="text-2xl font-bold font-display">{s.value}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Zap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-display font-bold text-lg">Nenhuma automação ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro fluxo para automatizar tarefas repetitivas.</p>
              <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Criar fluxo</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((a) => (
                <div key={a.id} className="bg-card border border-border rounded-2xl p-5 shadow-card flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-bold text-base truncate">{a.name}</h4>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${a.is_active ? "bg-success/10 text-success border border-success/20" : "bg-muted text-muted-foreground border border-border"}`}>
                        {a.is_active ? "Ativo" : "Pausado"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-muted">{triggerLabel(a.trigger_type)}</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="px-2 py-0.5 rounded bg-muted">{actionLabel(a.action_type)}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => toggle(a)} title={a.is_active ? "Pausar" : "Ativar"}>
                    {a.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => remove(a.id)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova automação</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do fluxo</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Boas-vindas WhatsApp" />
            </div>
            <div>
              <Label>Quando (gatilho)</Label>
              <Select value={form.trigger_type} onValueChange={(v) => setForm({ ...form, trigger_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Então (ação)</Label>
              <Select value={form.action_type} onValueChange={(v) => setForm({ ...form, action_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.action_type === "send_message" && (
              <div>
                <Label>Mensagem</Label>
                <Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Olá {{nome}}, obrigado pelo contato!" />
              </div>
            )}
            {form.action_type === "send_email" && (
              <>
                <div>
                  <Label>Assunto do E-mail</Label>
                  <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Ex: Bem-vindo à nossa empresa!" />
                </div>
                <div>
                  <Label>Conteúdo (HTML aceito)</Label>
                  <Textarea rows={5} value={form.email_body} onChange={(e) => setForm({ ...form, email_body: e.target.value })} placeholder="Olá {{nome}}, estamos felizes em ter você conosco." />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create}>Criar fluxo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
