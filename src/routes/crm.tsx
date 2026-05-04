import { createFileRoute, Link } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import {
  Sparkles, UserPlus, Trello, Bot, Zap, MessageSquare, Instagram,
  ArrowRight, Users, Plus, Send, Clock, CheckCircle2, Package,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar, CartesianGrid,
} from "recharts";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "CRM — ConectaCRM" },
      { name: "description", content: "Hub central do CRM: leads, funil, bot e automações." },
    ],
  }),
  component: CrmHub,
});

const modules = [
  { title: "Base de Leads",     desc: "Gestão e qualificação de clientes potenciais", url: "/leads",         icon: UserPlus,       color: "text-primary", bg: "bg-primary/10" },
  { title: "Funil de Vendas",   desc: "Pipeline Kanban por estágio",                  url: "/funil",         icon: Trello,         color: "text-info",    bg: "bg-info/10" },
  { title: "Bot de Atendimento",desc: "IA que atende 24/7 no WhatsApp",               url: "/crm/bot",       icon: Bot,            color: "text-success", bg: "bg-success/10" },
  { title: "Catálogo da IA",    desc: "Produtos e serviços que o bot oferece",        url: "/crm/catalogo",  icon: Package,        color: "text-primary", bg: "bg-primary/10" },
  { title: "Automações",        desc: "Fluxos automáticos baseados em gatilhos",      url: "/automacao",     icon: Zap,            color: "text-warning", bg: "bg-warning/10" },
  { title: "WhatsApp",          desc: "Conversas em tempo real e automações",         url: "/whatsapp",      icon: MessageSquare,  color: "text-success", bg: "bg-success/10" },
  { title: "Instagram",         desc: "Gestão de Directs e Engajamento",              url: "/instagram",     icon: Instagram,      color: "text-primary", bg: "bg-primary/10" },
];

function CrmHub() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ leads: 0, pipelineValue: 0, botConvs: 0, won: 0, activeConvs: 0 });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [leadsSeries, setLeadsSeries] = useState<{ day: string; count: number }[]>([]);
  const [funnelSeries, setFunnelSeries] = useState<{ name: string; value: number; count: number }[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 29);

        // Run RPC + all queries fully in parallel — never block on any one failure
        const [rpcRes, activeRes, leadsRes, pipelineRes, botRes, stagesRes, latestRes, trendRes] = await Promise.all([
          supabase.rpc("ensure_default_funnel_stages", { _user_id: user.id }),
          supabase.from("bot_conversations").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "active"),
          supabase.from("leads").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("pipeline_leads").select("deal_value, stage_id").eq("user_id", user.id),
          supabase.from("bot_conversations").select("*", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("funnel_stages").select("id, name, order_index").eq("user_id", user.id).order("order_index"),
          supabase.from("leads").select("id, name, phone, source, status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
          supabase.from("leads").select("created_at").eq("user_id", user.id).gte("created_at", since.toISOString()),
        ]);

        if (cancelled) return;

        if (rpcRes.error) console.warn("[crm] ensure_default_funnel_stages:", rpcRes.error.message);

        const stages = stagesRes.data ?? [];
        const pipeline = pipelineRes.data ?? [];
        const wonStageIds = stages.filter((s: any) => /ganho|fechado|won/i.test(s.name)).map((s: any) => s.id);
        const won = pipeline.filter((p: any) => wonStageIds.includes(p.stage_id)).reduce((s: number, p: any) => s + Number(p.deal_value ?? 0), 0);
        const total = pipeline.reduce((s: number, p: any) => s + Number(p.deal_value ?? 0), 0);

        setStats({
          leads: leadsRes.count ?? 0,
          pipelineValue: total,
          botConvs: botRes.count ?? 0,
          won,
          activeConvs: activeRes.count ?? 0,
        });
        setRecentLeads(latestRes.data ?? []);

        // Daily leads series last 30 days
        const days: { day: string; count: number }[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          days.push({ day: d.toISOString().slice(5, 10), count: 0 });
        }
        (trendRes.data ?? []).forEach((l: any) => {
          const k = l.created_at.slice(5, 10);
          const item = days.find((d) => d.day === k);
          if (item) item.count++;
        });
        setLeadsSeries(days);

        setFunnelSeries(stages.map((s: any) => {
          const inStage = pipeline.filter((p: any) => p.stage_id === s.id);
          return {
            name: s.name,
            count: inStage.length,
            value: inStage.reduce((sum: number, p: any) => sum + Number(p.deal_value ?? 0), 0),
          };
        }));
      } catch (e) {
        console.error("[crm] load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="CRM" subtitle="Hub de Experiência do Cliente" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Hero */}
          <div className="rounded-2xl bg-gradient-sidebar-cta p-8 text-white shadow-elegant relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Sparkles className="h-40 w-40" />
            </div>
            <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80 mb-3">
                <Sparkles className="h-4 w-4" /> CRM Unificado
              </div>
              <h2 className="text-3xl font-bold font-display mb-3">
                {greeting}, {user?.email?.split("@")[0] ?? "Usuário"}!
              </h2>
              <p className="text-white/85 leading-relaxed max-w-xl">
                Gerencie a jornada do seu cliente do primeiro contato ao pós-venda.
                Foco hoje: aumentar sua taxa de conversão.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link to="/leads" className="flex items-center gap-2 bg-white text-primary px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:opacity-90 transition">
                  <Plus className="h-4 w-4" /> Novo Lead
                </Link>
                <Link to="/crm/conversas" className="flex items-center gap-2 bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/30 transition border border-white/20">
                  <MessageSquare className="h-4 w-4" /> Ver Conversas
                </Link>
                <button className="flex items-center gap-2 bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition border border-white/10">
                  <Send className="h-4 w-4" /> Disparo em Massa
                </button>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-card border border-border animate-pulse" />
              ))
            ) : (
              <>
                <Kpi icon={Clock}         label="Tempo de Resposta"  value="< 2 min"                                color="text-success" bg="bg-success/10" />
                <Kpi icon={CheckCircle2}  label="Taxa de Conversão" value="12.4%"                                  color="text-primary" bg="bg-primary/10" />
                <Kpi icon={Users}         label="Leads Ativos"      value={stats.leads.toLocaleString("pt-BR")}    color="text-info"    bg="bg-info/10" />
                <Kpi icon={MessageSquare} label="Conversas Abertas" value={stats.activeConvs.toString()}            color="text-warning" bg="bg-warning/10" />
              </>
            )}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-card">
              <div className="mb-4">
                <h3 className="font-bold font-display">Leads nos últimos 30 dias</h3>
                <p className="text-xs text-muted-foreground">Evolução diária de novos contatos</p>
              </div>
              <div className="h-56">
                {loading ? (
                  <div className="h-full w-full bg-muted/40 rounded-lg animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={leadsSeries}>
                      <defs>
                        <linearGradient id="grLead" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={10} />
                      <YAxis stroke="var(--color-muted-foreground)" fontSize={10} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} fill="url(#grLead)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-card">
              <h3 className="font-bold font-display mb-1">Funil por etapa</h3>
              <p className="text-xs text-muted-foreground mb-4">Negócios em cada estágio</p>
              <div className="h-56">
                {loading ? (
                  <div className="h-full w-full bg-muted/40 rounded-lg animate-pulse" />
                ) : funnelSeries.length === 0 ? (
                  <div className="h-full grid place-items-center text-xs text-muted-foreground italic">Sem etapas configuradas</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelSeries} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                      <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={10} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={10} width={80} />
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Modules grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m) => (
              <Link
                key={m.url}
                to={m.url}
                className="group bg-card border border-border rounded-2xl p-5 shadow-card hover:shadow-elegant hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-11 w-11 rounded-xl ${m.bg} ${m.color} grid place-items-center`}>
                    <m.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />
                </div>
                <h3 className="font-bold font-display text-base mb-1">{m.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
              </Link>
            ))}
          </div>

          {/* Recent leads */}
          <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display">Leads recentes</h3>
                <p className="text-xs text-muted-foreground">Últimos contatos cadastrados</p>
              </div>
              <Link to="/leads" className="text-xs font-bold text-primary hover:underline">Ver todos →</Link>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4">
                    <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-2.5 w-20 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))
              ) : recentLeads.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum lead ainda. <Link to="/leads" className="text-primary font-bold hover:underline">Cadastre o primeiro</Link>.
                </div>
              ) : (
                recentLeads.map((l) => (
                  <div key={l.id} className="px-5 py-3 flex items-center gap-4 hover:bg-muted/30 transition">
                    <div className="h-9 w-9 rounded-xl bg-gradient-primary text-white grid place-items-center text-xs font-bold">
                      {l.name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("") || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{l.name}</div>
                      <div className="text-xs text-muted-foreground">{l.phone || "—"}</div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{l.source || "manual"}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Customer experience tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Dica de Experiência</h3>
                  <p className="text-xs text-muted-foreground">Otimize sua conversão</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">
                Clientes que recebem resposta nos primeiros <strong>5 minutos</strong> têm 10× mais chances de converter. Verifique suas conversas pendentes.
              </p>
            </div>

            <div className="bg-gradient-to-br from-success/5 to-transparent border border-success/20 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-success/10 text-success grid place-items-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Saúde da Carteira</h3>
                  <p className="text-xs text-muted-foreground">Engajamento dos clientes</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-success/10 rounded-full overflow-hidden">
                  <div className="h-full bg-success w-[85%]" />
                </div>
                <span className="text-sm font-bold text-success">Excelente (85%)</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <div className={`h-8 w-8 rounded-lg ${bg} ${color} grid place-items-center`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold font-display">{value}</div>
    </div>
  );
}