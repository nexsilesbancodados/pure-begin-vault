import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Mail,
  MessageSquare,
  Bell,
  Power,
  Check,
  Plus,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/automacoes")({
  component: AutomacoesPage,
});

type Template = {
  id: string;
  category: string;
  trigger_type: string;
  channel: string;
  name: string;
  description: string | null;
  default_subject: string | null;
  default_body: string;
  variables: string[];
  active_by_default: boolean;
};

type Install = {
  id: string;
  template_id: string | null;
  trigger_type: string;
  channel: string;
  subject: string | null;
  body: string;
  is_active: boolean;
  total_runs: number;
  total_failures: number;
  last_run_at: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  transactional: "Transacional",
  operational: "Operacional",
  engagement: "Engajamento",
  marketing: "Marketing",
};

const CHANNEL_ICONS: Record<string, any> = {
  whatsapp: MessageSquare,
  email: Mail,
  internal: Bell,
  both: Zap,
};

function AutomacoesPage() {
  const { orgId, userId } = useOrg();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [installs, setInstalls] = useState<Install[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ subject: "", body: "" });

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const [tRes, iRes] = await Promise.all([
      (supabase as any).from("automation_templates").select("*").order("category, name"),
      (supabase as any).from("automation_installs").select("*").eq("organization_id", orgId),
    ]);
    setTemplates((tRes.data as Template[]) ?? []);
    setInstalls((iRes.data as Install[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  const installByTpl = useMemo(() => {
    const m = new Map<string, Install>();
    for (const i of installs) {
      if (i.template_id) m.set(i.template_id, i);
    }
    return m;
  }, [installs]);

  const filtered = useMemo(() => {
    if (filter === "all") return templates;
    if (filter === "active") return templates.filter((t) => installByTpl.get(t.id)?.is_active);
    return templates.filter((t) => t.category === filter);
  }, [templates, filter, installByTpl]);

  const toggle = async (tpl: Template) => {
    if (!orgId || !userId) return;
    const existing = installByTpl.get(tpl.id);
    if (existing) {
      const { error } = await (supabase as any)
        .from("automation_installs")
        .update({ is_active: !existing.is_active, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success(existing.is_active ? "Automação desativada" : "Automação ativada");
    } else {
      const { error } = await (supabase as any).from("automation_installs").insert({
        organization_id: orgId,
        user_id: userId,
        template_id: tpl.id,
        trigger_type: tpl.trigger_type,
        channel: tpl.channel,
        subject: tpl.default_subject,
        body: tpl.default_body,
        is_active: true,
      });
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Automação ativada");
    }
    load();
  };

  const startEdit = (inst: Install) => {
    setEditingId(inst.id);
    setDraft({ subject: inst.subject ?? "", body: inst.body });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await (supabase as any)
      .from("automation_installs")
      .update({
        subject: draft.subject || null,
        body: draft.body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Mensagem atualizada");
    setEditingId(null);
    load();
  };

  const installArmazenadosNo = (cat: string) =>
    templates.filter((t) => t.category === cat && installByTpl.get(t.id)?.is_active).length;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Automações" subtitle="WhatsApp + email automáticos por evento" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Total templates" value={templates.length} />
            <Kpi label="Ativas" value={installs.filter((i) => i.is_active).length} color="success" />
            <Kpi label="WhatsApp" value={installs.filter((i) => i.is_active && i.channel === "whatsapp").length} />
            <Kpi label="Email" value={installs.filter((i) => i.is_active && i.channel === "email").length} />
          </div>

          <Card className="p-3 flex flex-wrap gap-2">
            {[
              { id: "all", label: "Todas" },
              { id: "active", label: "Ativas" },
              { id: "transactional", label: "Transacional" },
              { id: "operational", label: "Operacional" },
              { id: "engagement", label: "Engajamento" },
              { id: "marketing", label: "Marketing" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filter === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border hover:border-primary/40"
                }`}
              >
                {f.label}
              </button>
            ))}
          </Card>

          {loading ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((tpl) => {
                const inst = installByTpl.get(tpl.id);
                const active = inst?.is_active ?? false;
                const Icon = CHANNEL_ICONS[tpl.channel] ?? Zap;

                return (
                  <Card key={tpl.id} className={`p-4 ${active ? "border-success/40 bg-success/5" : ""}`}>
                    <div className="flex items-start gap-3 mb-2">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-sm">{tpl.name}</p>
                          <Badge className="text-[9px]">{CATEGORY_LABELS[tpl.category] ?? tpl.category}</Badge>
                          {tpl.active_by_default && (
                            <Badge variant="outline" className="text-[9px]"><Sparkles className="h-2 w-2 mr-0.5" /> Recomendada</Badge>
                          )}
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{tpl.description}</p>
                        )}
                        <p className="text-[10px] font-mono text-muted-foreground mt-1">
                          gatilho: {tpl.trigger_type}
                        </p>
                      </div>
                      <button
                        onClick={() => toggle(tpl)}
                        className={`h-8 px-3 rounded-lg text-xs font-bold transition shrink-0 ${
                          active
                            ? "bg-success text-success-foreground"
                            : "bg-muted hover:bg-muted-foreground/10"
                        }`}
                      >
                        {active ? <><Check className="inline h-3 w-3 mr-1" /> Ativa</> : <><Power className="inline h-3 w-3 mr-1" /> Ativar</>}
                      </button>
                    </div>

                    {editingId === inst?.id ? (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        {tpl.channel === "email" && (
                          <div>
                            <Label className="text-[10px]">Assunto</Label>
                            <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} className="h-8 text-xs" />
                          </div>
                        )}
                        <div>
                          <Label className="text-[10px]">Mensagem</Label>
                          <textarea
                            value={draft.body}
                            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                            rows={3}
                            className="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                          />
                          {tpl.variables.length > 0 && (
                            <p className="text-[9px] text-muted-foreground mt-1">
                              Variáveis: {tpl.variables.map((v) => `{{${v}}}`).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>Salvar</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-2 text-xs bg-muted/30 rounded p-2 line-clamp-3">
                          {inst?.body ?? tpl.default_body}
                        </div>
                        {inst && (
                          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>
                              {inst.total_runs} execuções
                              {inst.total_failures > 0 && ` · ${inst.total_failures} falhas`}
                            </span>
                            <button onClick={() => startEdit(inst)} className="font-bold text-primary hover:underline">
                              Editar mensagem
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="p-4 bg-muted/40 text-xs text-muted-foreground">
            <p>
              <strong>Como funciona:</strong> automações disparam quando o evento acontece
              (ex: OS muda status, venda finaliza). Automações temporais (aniversário,
              inativos, OS atrasada) são processadas 1×/dia pela Edge Function
              <code> daily-automations</code>. Você pode customizar a mensagem clicando em
              "Editar".
            </p>
          </Card>
        </main>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: "success" }) {
  return (
    <Card className="p-3">
      <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">{label}</p>
      <p className={`text-2xl font-black ${color === "success" ? "text-success" : "text-foreground"}`}>{value}</p>
    </Card>
  );
}
