import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, Sparkles, MessageSquare, Clock, Brain, Save, Loader2, Power, Users, Zap, Smartphone, Copy, Send, Webhook } from "lucide-react";
import { evolution } from "@/lib/evolution";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/crm_/bot")({
  head: () => ({
    meta: [
      { title: "Bot de Atendimento — CRM" },
      { name: "description", content: "Configure o bot de atendimento com IA para seu WhatsApp." },
    ],
  }),
  component: BotPage,
});

const WEEKDAYS = [
  { id: 0, label: "Dom" },
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
];

type BusinessHours = { enabled: boolean; start: string; end: string; days: number[] };

type BotForm = {
  is_active: boolean;
  bot_name: string;
  greeting: string;
  away_message: string;
  fallback_message: string;
  business_hours: BusinessHours;
  ai_provider: string;
  ai_model: string;
  ai_temperature: number;
  system_prompt: string;
  handoff_keywords: string[];
  auto_reply_delay_seconds: number;
  max_messages_before_handoff: number;
  collect_lead_info: boolean;
  whatsapp_instance: string | null;
};

const DEFAULTS: BotForm = {
  is_active: false,
  bot_name: "Assistente Virtual",
  greeting: "Olá! 👋 Sou o assistente virtual. Como posso ajudar?",
  away_message: "No momento estamos fora do horário de atendimento. Retornaremos em breve!",
  fallback_message: "Desculpe, não entendi. Vou transferir para um atendente humano.",
  business_hours: { enabled: false, start: "08:00", end: "18:00", days: [1, 2, 3, 4, 5] },
  ai_provider: "deepseek",
  ai_model: "deepseek-chat",
  ai_temperature: 0.7,
  system_prompt: "Você é um atendente cordial de uma loja de celulares. Responda de forma breve, clara e amigável.",
  handoff_keywords: ["humano", "atendente", "pessoa"],
  auto_reply_delay_seconds: 2,
  max_messages_before_handoff: 10,
  collect_lead_info: true,
  whatsapp_instance: null,
};

function BotPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<BotForm>(DEFAULTS);
  const [keywordsText, setKeywordsText] = useState(DEFAULTS.handoff_keywords.join(", "));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [instances, setInstances] = useState<{ id: string; instance_name: string; status: string | null }[]>([]);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [testInput, setTestInput] = useState("");
  const [testMessages, setTestMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("bot_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        if (error) {
          console.error("bot_settings load error", error);
          toast.error("Erro ao carregar bot: " + error.message);
        }
        if (data) {
        const next: BotForm = {
          is_active: data.is_active,
          bot_name: data.bot_name,
          greeting: data.greeting,
          away_message: data.away_message,
          fallback_message: data.fallback_message,
          business_hours: (data.business_hours as any) ?? DEFAULTS.business_hours,
          ai_provider: data.ai_provider,
          ai_model: data.ai_model,
          ai_temperature: Number(data.ai_temperature),
          system_prompt: data.system_prompt,
          handoff_keywords: data.handoff_keywords ?? [],
          auto_reply_delay_seconds: data.auto_reply_delay_seconds,
          max_messages_before_handoff: data.max_messages_before_handoff,
          collect_lead_info: data.collect_lead_info,
          whatsapp_instance: (data as any).whatsapp_instance ?? null,
        };
        setForm(next);
        setKeywordsText(next.handoff_keywords.join(", "));
        setWebhookSecret((data as any).webhook_secret ?? null);
        }
        const { data: inst, error: instErr } = await supabase
          .from("whatsapp_instances")
          .select("id, instance_name, status")
          .eq("user_id", user.id);
        if (instErr) console.error("whatsapp_instances load error", instErr);
        setInstances(inst ?? []);
      } catch (e) {
        console.error("Bot page load failed", e);
        toast.error("Falha ao carregar configurações do bot");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const update = <K extends keyof BotForm>(key: K, value: BotForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateHours = <K extends keyof BusinessHours>(key: K, value: BusinessHours[K]) =>
    setForm((prev) => ({ ...prev, business_hours: { ...prev.business_hours, [key]: value } }));

  const toggleDay = (id: number) => {
    const days = form.business_hours.days.includes(id)
      ? form.business_hours.days.filter((d) => d !== id)
      : [...form.business_hours.days, id].sort();
    updateHours("days", days);
  };

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    const handoff_keywords = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const payload = { ...form, handoff_keywords, user_id: user.id };
    const { error } = await supabase
      .from("bot_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select("webhook_secret")
      .maybeSingle();
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Configurações do bot salvas!");
      update("handoff_keywords", handoff_keywords);
    }
  };

  const projectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "";
  const webhookUrl = projectRef && webhookSecret && user?.id
    ? `https://${projectRef}.supabase.co/functions/v1/bot-webhook?uid=${user.id}&secret=${webhookSecret}`
    : "";

  const copyWebhook = async () => {
    if (!webhookUrl) return toast.error("Salve as configurações para gerar o webhook.");
    await navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  const sendTest = async () => {
    const text = testInput.trim();
    if (!text || testLoading) return;
    const next = [...testMessages, { role: "user" as const, content: text }];
    setTestMessages(next);
    setTestInput("");
    setTestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("bot-test", {
        body: { messages: next },
      });
      if (error) throw error;
      const reply = (data as any)?.reply ?? (data as any)?.error ?? form.fallback_message;
      setTestMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setTestMessages((m) => [...m, { role: "assistant", content: "Erro: " + (e?.message ?? String(e)) }]);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Bot de Atendimento" subtitle="Configure seu atendente virtual com IA" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Hero status */}
          <div className="rounded-2xl bg-gradient-sidebar-cta p-6 text-white shadow-elegant relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Bot className="h-32 w-32" />
            </div>
            <div className="relative z-10 flex items-center justify-between gap-6 flex-wrap">
              <div className="max-w-xl">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80 mb-2">
                  <Sparkles className="h-4 w-4" /> Bot com IA
                </div>
                <h2 className="text-2xl font-bold font-display mb-1">{form.bot_name}</h2>
                <p className="text-white/85 text-sm">
                  {form.is_active ? "Ativo · respondendo automaticamente no WhatsApp." : "Desativado · ative para começar a atender."}
                </p>
              </div>
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-xl px-4 py-3">
                <Power className={`h-5 w-5 ${form.is_active ? "text-success" : "text-white/60"}`} />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/70 font-bold">Status</div>
                  <div className="text-sm font-bold">{form.is_active ? "Online" : "Offline"}</div>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => update("is_active", v)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-card border border-border p-12 grid place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna principal */}
              <div className="lg:col-span-2 space-y-6">
                {/* Identidade */}
                <Section icon={Bot} title="Identidade do Bot" desc="Nome e mensagens base">
                  <div className="space-y-4">
                    <div>
                      <Label>Nome do bot</Label>
                      <Input value={form.bot_name} onChange={(e) => update("bot_name", e.target.value)} />
                    </div>
                    <div>
                      <Label>Mensagem de boas-vindas</Label>
                      <Textarea rows={3} value={form.greeting} onChange={(e) => update("greeting", e.target.value)} />
                    </div>
                    <div>
                      <Label>Mensagem fora do horário</Label>
                      <Textarea rows={2} value={form.away_message} onChange={(e) => update("away_message", e.target.value)} />
                    </div>
                    <div>
                      <Label>Mensagem de fallback (não entendeu)</Label>
                      <Textarea rows={2} value={form.fallback_message} onChange={(e) => update("fallback_message", e.target.value)} />
                    </div>
                  </div>
                </Section>

                {/* IA */}
                <Section icon={Brain} title="Inteligência Artificial" desc="Modelo, criatividade e personalidade">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Provedor</Label>
                        <Select value={form.ai_provider} onValueChange={(v) => update("ai_provider", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deepseek">DeepSeek</SelectItem>
                            <SelectItem value="lovable">Lovable AI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Modelo</Label>
                        <Select value={form.ai_model} onValueChange={(v) => update("ai_model", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deepseek-chat">deepseek-chat</SelectItem>
                            <SelectItem value="deepseek-reasoner">deepseek-reasoner</SelectItem>
                            <SelectItem value="google/gemini-2.5-flash">gemini-2.5-flash</SelectItem>
                            <SelectItem value="google/gemini-2.5-pro">gemini-2.5-pro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <Label>Criatividade (temperatura)</Label>
                        <span className="text-xs font-bold text-primary">{form.ai_temperature.toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[form.ai_temperature]}
                        min={0}
                        max={1}
                        step={0.1}
                        onValueChange={([v]) => update("ai_temperature", v)}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                        <span>Conservador</span><span>Criativo</span>
                      </div>
                    </div>

                    <div>
                      <Label>Personalidade / instruções (prompt do sistema)</Label>
                      <Textarea
                        rows={6}
                        value={form.system_prompt}
                        onChange={(e) => update("system_prompt", e.target.value)}
                        placeholder="Descreva como o bot deve se comportar, o tom de voz e o que ele sabe..."
                      />
                    </div>
                  </div>
                </Section>

                {/* Handoff */}
                <Section icon={Users} title="Transferência para humano" desc="Quando passar a conversa para um atendente">
                  <div className="space-y-4">
                    <div>
                      <Label>Palavras-chave (separadas por vírgula)</Label>
                      <Input
                        value={keywordsText}
                        onChange={(e) => setKeywordsText(e.target.value)}
                        placeholder="humano, atendente, falar com pessoa"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Máx. de mensagens antes de transferir</Label>
                        <Input
                          type="number"
                          min={1}
                          value={form.max_messages_before_handoff}
                          onChange={(e) => update("max_messages_before_handoff", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label>Atraso de resposta (segundos)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={form.auto_reply_delay_seconds}
                          onChange={(e) => update("auto_reply_delay_seconds", Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <label className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                      <div>
                        <div className="text-sm font-bold">Coletar dados do lead</div>
                        <div className="text-xs text-muted-foreground">Pergunta nome e interesse antes de qualificar</div>
                      </div>
                      <Switch
                        checked={form.collect_lead_info}
                        onCheckedChange={(v) => update("collect_lead_info", v)}
                      />
                    </label>
                  </div>
                </Section>
              </div>

              {/* Coluna lateral */}
              <div className="space-y-6">
                {/* WhatsApp */}
                <Section icon={Smartphone} title="WhatsApp" desc="Instância conectada ao bot">
                  <div className="space-y-3">
                    {instances.length === 0 ? (
                      <div className="text-xs text-muted-foreground">
                        Nenhuma instância. Conecte uma em <a href="/whatsapp" className="text-primary underline">WhatsApp</a>.
                      </div>
                    ) : (
                      <Select
                        value={form.whatsapp_instance ?? ""}
                        onValueChange={(v) => update("whatsapp_instance", v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione uma instância" /></SelectTrigger>
                        <SelectContent>
                          {instances.map((i) => (
                            <SelectItem key={i.id} value={i.instance_name}>
                              {i.instance_name} {i.status ? `· ${i.status}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </Section>

                {/* Webhook */}
                <Section icon={Webhook} title="Webhook" desc="Configure na Evolution API">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input readOnly value={webhookUrl} placeholder="Salve para gerar a URL" className="font-mono text-[11px]" />
                      <Button type="button" variant="outline" size="icon" onClick={copyWebhook}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={!webhookUrl || !form.whatsapp_instance}
                      onClick={async () => {
                        try {
                          await evolution.setWebhook(form.whatsapp_instance!, webhookUrl);
                          toast.success("Webhook configurado na Evolution!");
                        } catch (e: any) {
                          toast.error("Falha: " + (e?.message ?? String(e)));
                        }
                      }}
                    >
                      Configurar webhook automaticamente
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Ou copie e cole no campo de webhook da sua instância Evolution.
                    </p>
                  </div>
                </Section>

                {/* Chat de teste */}
                <Section icon={MessageSquare} title="Testar bot" desc="Simule uma conversa">
                  <div className="space-y-3">
                    <div className="h-56 overflow-y-auto rounded-lg bg-muted/40 border border-border p-3 space-y-2 text-sm">
                      {testMessages.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-8">
                          Envie uma mensagem para testar.
                        </div>
                      ) : (
                        testMessages.map((m, i) => (
                          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                              {m.content}
                            </div>
                          </div>
                        ))
                      )}
                      {testLoading && (
                        <div className="flex justify-start">
                          <div className="px-3 py-2 rounded-2xl bg-card border border-border">
                            <Loader2 className="h-3 w-3 animate-spin" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendTest()}
                        placeholder="Escreva uma mensagem..."
                      />
                      <Button type="button" size="icon" onClick={sendTest} disabled={testLoading}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Section>

                {/* Horário */}
                <Section icon={Clock} title="Horário de atendimento" desc="Quando o bot deve estar ativo">
                  <div className="space-y-4">
                    <label className="flex items-center justify-between">
                      <span className="text-sm font-medium">Restringir por horário</span>
                      <Switch
                        checked={form.business_hours.enabled}
                        onCheckedChange={(v) => updateHours("enabled", v)}
                      />
                    </label>

                    <div className={`space-y-3 ${form.business_hours.enabled ? "" : "opacity-50 pointer-events-none"}`}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Início</Label>
                          <Input type="time" value={form.business_hours.start} onChange={(e) => updateHours("start", e.target.value)} />
                        </div>
                        <div>
                          <Label>Fim</Label>
                          <Input type="time" value={form.business_hours.end} onChange={(e) => updateHours("end", e.target.value)} />
                        </div>
                      </div>

                      <div>
                        <Label>Dias da semana</Label>
                        <div className="grid grid-cols-7 gap-1 mt-1">
                          {WEEKDAYS.map((d) => {
                            const active = form.business_hours.days.includes(d.id);
                            return (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => toggleDay(d.id)}
                                className={`h-9 rounded-lg text-[11px] font-bold transition border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground hover:bg-muted/70"}`}
                              >
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>

                <Section icon={Zap} title="Dicas rápidas" desc="">
                  <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                    <li className="flex gap-2"><MessageSquare className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /> Conecte uma instância em <b>WhatsApp</b> antes de ativar o bot.</li>
                    <li className="flex gap-2"><Brain className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /> Quanto menor a temperatura, mais previsível a resposta.</li>
                    <li className="flex gap-2"><Users className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /> Use palavras-chave que seus clientes realmente digitam.</li>
                  </ul>
                </Section>
              </div>
            </div>
          )}

          <div className="sticky bottom-4 z-40 max-w-7xl mx-auto px-6 py-4 bg-white/80 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-indigo-500/10 rounded-[2rem] flex items-center justify-between gap-3">
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-slate-400">Última alteração: <span className="text-slate-900">Hoje</span></p>
            </div>
            <Button onClick={save} disabled={saving || loading} className="h-12 px-8 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold shadow-lg shadow-indigo-500/30 hover:opacity-95 transition-all gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: any; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all overflow-hidden group">
      <div className="px-6 py-5 border-b border-slate-50 flex items-center gap-4">
        <div className="h-10 w-10 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center group-hover:scale-110 transition-transform">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
          {desc && <p className="text-[11px] font-bold text-slate-400 mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}