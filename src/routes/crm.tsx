import { createFileRoute, Link } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import {
  Sparkles,
  UserPlus,
  Trello,
  Bot,
  Zap,
  MessageSquare,
  Instagram,
  Users,
  Plus,
  Send,
  Clock,
  CheckCircle2,
  Package,
  TrendingUp,
  Target,
  ArrowUpRight,
  Phone,
  Globe,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { FeatureCard, type FeatureCardTone } from "@/components/ui/FeatureCard";

export const Route = createFileRoute("/crm")({
  head: () => ({
    meta: [
      { title: "CRM — ConectaCRM" },
      { name: "description", content: "Hub central do CRM: leads, funil, bot e automações." },
    ],
  }),
  component: CrmHub,
});

const modules: { title: string; desc: string; url: string; icon: any; tone: FeatureCardTone }[] = [
  {
    title: "Base de Leads",
    desc: "Gestão e qualificação de clientes potenciais",
    url: "/leads",
    icon: UserPlus,
    tone: "violet",
  },
  {
    title: "Funil de Vendas",
    desc: "Pipeline Kanban por estágio",
    url: "/funil",
    icon: Trello,
    tone: "info",
  },
  {
    title: "Bot de Atendimento",
    desc: "IA que atende 24/7 no WhatsApp",
    url: "/crm/bot",
    icon: Bot,
    tone: "success",
  },
  {
    title: "Catálogo da IA",
    desc: "Produtos e serviços que o bot oferece",
    url: "/crm/catalogo",
    icon: Package,
    tone: "violet",
  },
  {
    title: "Automações",
    desc: "Fluxos automáticos baseados em gatilhos",
    url: "/automacao",
    icon: Zap,
    tone: "warning",
  },
  {
    title: "WhatsApp",
    desc: "Conversas em tempo real e automações",
    url: "/whatsapp",
    icon: MessageSquare,
    tone: "success",
  },
  {
    title: "Instagram",
    desc: "Gestão de Directs e Engajamento",
    url: "/instagram",
    icon: Instagram,
    tone: "violet",
  },
];

const sourceMeta: Record<string, { icon: any; class: string; label: string }> = {
  whatsapp: { icon: MessageSquare, class: "bg-success/10 text-success ring-success/20", label: "WhatsApp" },
  instagram: { icon: Instagram, class: "bg-pink-500/10 text-pink-500 ring-pink-500/20", label: "Instagram" },
  site: { icon: Globe, class: "bg-info/10 text-info ring-info/20", label: "Site" },
  manual: { icon: UserPlus, class: "bg-muted text-muted-foreground ring-border", label: "Manual" },
};
const sourceFor = (s?: string) => {
  const k = (s || "manual").toLowerCase();
  if (k.includes("whats")) return sourceMeta.whatsapp;
  if (k.includes("insta")) return sourceMeta.instagram;
  if (k.includes("site") || k.includes("web")) return sourceMeta.site;
  return sourceMeta.manual;
};

const statusMeta: Record<string, string> = {
  novo: "bg-info/10 text-info ring-info/20",
  em_atendimento: "bg-warning/15 text-[oklch(0.55_0.15_75)] ring-warning/25",
  proposta: "bg-primary/10 text-primary ring-primary/20",
  ganho: "bg-success/10 text-success ring-success/20",
  perdido: "bg-destructive/10 text-destructive ring-destructive/20",
};

function CrmHub() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    leads: 0,
    pipelineValue: 0,
    botConvs: 0,
    won: 0,
    activeConvs: 0,
    leadsLast7: 0,
    leadsPrev7: 0,
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [leadsSeries, setLeadsSeries] = useState<{ day: string; count: number }[]>([]);
  const [funnelSeries, setFunnelSeries] = useState<
    { name: string; value: number; count: number }[]
  >([]);

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

        const filt = <T extends any>(q: any) =>
          orgId ? q.eq("organization_id", orgId) : q.eq("user_id", user.id);

        const [rpcRes, activeRes, leadsRes, pipelineRes, botRes, stagesRes, latestRes, trendRes] =
          await Promise.all([
            supabase.rpc("ensure_default_funnel_stages", { _user_id: user.id }),
            filt(
              supabase
                .from("bot_conversations")
                .select("*", { count: "exact", head: true })
                .eq("status", "active"),
            ),
            filt(supabase.from("leads").select("*", { count: "exact", head: true })),
            filt(supabase.from("pipeline_leads").select("deal_value, stage_id")),
            filt(supabase.from("bot_conversations").select("*", { count: "exact", head: true })),
            filt(supabase.from("funnel_stages").select("id, name, order_index")).order(
              "order_index",
            ),
            filt(supabase.from("leads").select("id, name, phone, source, status, created_at"))
              .order("created_at", { ascending: false })
              .limit(5),
            filt(supabase.from("leads").select("created_at")).gte(
              "created_at",
              since.toISOString(),
            ),
          ]);

        if (cancelled) return;

        if (rpcRes.error) console.warn("[crm] ensure_default_funnel_stages:", rpcRes.error.message);

        const stages = stagesRes.data ?? [];
        const pipeline = pipelineRes.data ?? [];
        const wonStageIds = stages
          .filter((s: any) => /ganho|fechado|won/i.test(s.name))
          .map((s: any) => s.id);
        const won = pipeline
          .filter((p: any) => wonStageIds.includes(p.stage_id))
          .reduce((s: number, p: any) => s + Number(p.deal_value ?? 0), 0);
        const total = pipeline.reduce((s: number, p: any) => s + Number(p.deal_value ?? 0), 0);

        // Daily leads series last 30 days + 7d momentum
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
        const last7 = days.slice(-7).reduce((a, b) => a + b.count, 0);
        const prev7 = days.slice(-14, -7).reduce((a, b) => a + b.count, 0);

        setStats({
          leads: leadsRes.count ?? 0,
          pipelineValue: total,
          botConvs: botRes.count ?? 0,
          won,
          activeConvs: activeRes.count ?? 0,
          leadsLast7: last7,
          leadsPrev7: prev7,
        });
        setRecentLeads(latestRes.data ?? []);
        setLeadsSeries(days);

        setFunnelSeries(
          stages.map((s: any) => {
            const inStage = pipeline.filter((p: any) => p.stage_id === s.id);
            return {
              name: s.name,
              count: inStage.length,
              value: inStage.reduce((sum: number, p: any) => sum + Number(p.deal_value ?? 0), 0),
            };
          }),
        );
      } catch (e) {
        console.error("[crm] load failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, orgId]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  const conversionRate =
    stats.pipelineValue + stats.won > 0
      ? (stats.won / (stats.pipelineValue + stats.won)) * 100
      : 0;
  const trend7 =
    stats.leadsPrev7 === 0
      ? stats.leadsLast7 > 0
        ? 100
        : 0
      : ((stats.leadsLast7 - stats.leadsPrev7) / stats.leadsPrev7) * 100;
  const ticketMedio =
    stats.leads > 0 ? stats.pipelineValue / Math.max(stats.leads, 1) : 0;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="CRM" subtitle="Hub de Experiência do Cliente" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Hero */}
          <div className="group relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-hero p-7 md:p-9 text-white shadow-elegant ring-1 ring-white/10">
            {/* highlight line */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
            {/* orbs */}
            <div
              aria-hidden
              className="absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl animate-pulse"
              style={{ background: "oklch(0.78 0.14 220)" }}
            />
            <div
              aria-hidden
              className="absolute -bottom-28 -left-12 h-80 w-80 rounded-full opacity-25 blur-3xl animate-pulse"
              style={{ background: "oklch(0.55 0.22 270)", animationDelay: "1.4s" }}
            />
            {/* grid */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
              style={{
                backgroundImage:
                  "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            {/* shine */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1400ms] ease-out bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
            />

            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[11px] font-bold uppercase tracking-widest mb-4 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <Sparkles className="h-3 w-3" /> CRM Unificado
              </div>
              <h2 className="text-3xl md:text-[34px] font-bold font-display tracking-tight mb-3 drop-shadow-sm">
                {greeting}, {user?.email?.split("@")[0] ?? "Usuário"}!
              </h2>
              <p className="text-white/85 leading-relaxed max-w-xl text-sm md:text-base">
                Gerencie a jornada do seu cliente do primeiro contato ao pós-venda. Foco hoje:{" "}
                <span className="font-bold underline decoration-white/40 underline-offset-4">
                  aumentar a conversão
                </span>
                .
              </p>

              {/* mini stats inline */}
              <div className="mt-5 flex flex-wrap gap-2">
                <MiniStat icon={Users} label={`${stats.leadsLast7} leads em 7d`} />
                <MiniStat icon={MessageSquare} label={`${stats.activeConvs} conversas ativas`} />
                <MiniStat icon={Target} label={`${conversionRate.toFixed(1)}% conversão`} />
              </div>

              <div className="flex flex-wrap gap-3 mt-7">
                <Link
                  to="/leads"
                  className="group/btn flex items-center gap-2 bg-white text-foreground px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-black/10 hover:scale-[1.04] active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <Plus className="h-4 w-4 text-primary group-hover/btn:rotate-90 transition-transform" />{" "}
                  Novo Lead
                </Link>
                <Link
                  to="/crm/conversas"
                  className="group/btn flex items-center gap-2 bg-white/15 backdrop-blur-md text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/25 transition border border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <MessageSquare className="h-4 w-4" /> Conversas
                  <ArrowUpRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                </Link>
                <Link
                  to="/broadcast"
                  className="group/btn flex items-center gap-2 bg-white/10 backdrop-blur-md text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/20 transition border border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <Send className="h-4 w-4" /> Disparo em Massa
                </Link>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 rounded-2xl bg-card border border-border animate-pulse"
                />
              ))
            ) : (
              <>
                <Kpi
                  icon={CheckCircle2}
                  label="Pipeline"
                  value={`R$ ${stats.pipelineValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
                  tone="primary"
                  hint="em negociação"
                />
                <Kpi
                  icon={Clock}
                  label="Vendas Ganhas"
                  value={`R$ ${stats.won.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`}
                  tone="success"
                  hint="acumulado"
                />
                <Kpi
                  icon={Users}
                  label="Leads"
                  value={stats.leads.toLocaleString("pt-BR")}
                  tone="info"
                  trend={trend7}
                  hint={`${stats.leadsLast7} em 7d`}
                />
                <Kpi
                  icon={Target}
                  label="Conversão"
                  value={`${conversionRate.toFixed(1)}%`}
                  tone="violet"
                  hint="ganho / total"
                />
                <Kpi
                  icon={MessageSquare}
                  label="Conversas"
                  value={stats.activeConvs.toString()}
                  tone="warning"
                  hint="abertas agora"
                />
              </>
            )}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 relative overflow-hidden bg-card border border-border rounded-2xl p-5 shadow-card">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
              />
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold font-display flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Leads — últimos 30 dias
                  </h3>
                  <p className="text-xs text-muted-foreground">Evolução diária de novos contatos</p>
                </div>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ring-inset ${
                    trend7 >= 0
                      ? "bg-success/10 text-success ring-success/20"
                      : "bg-destructive/10 text-destructive ring-destructive/20"
                  }`}
                >
                  {trend7 >= 0 ? "↑" : "↓"} {Math.abs(trend7).toFixed(0)}% vs 7d
                </span>
              </div>
              <div className="h-56">
                {loading ? (
                  <div className="h-full w-full bg-muted/40 rounded-lg animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={leadsSeries}>
                      <defs>
                        <linearGradient id="grLead" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={10} />
                      <YAxis
                        stroke="var(--color-muted-foreground)"
                        fontSize={10}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 12,
                          fontSize: 12,
                          boxShadow: "var(--shadow-elegant)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="var(--color-primary)"
                        strokeWidth={2.5}
                        fill="url(#grLead)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="relative overflow-hidden bg-card border border-border rounded-2xl p-5 shadow-card">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-info/30 to-transparent"
              />
              <h3 className="font-bold font-display mb-1 flex items-center gap-2">
                <Trello className="h-4 w-4 text-info" /> Funil por etapa
              </h3>
              <p className="text-xs text-muted-foreground mb-4">Negócios em cada estágio</p>
              <div className="h-56">
                {loading ? (
                  <div className="h-full w-full bg-muted/40 rounded-lg animate-pulse" />
                ) : funnelSeries.length === 0 ? (
                  <div className="h-full grid place-items-center text-xs text-muted-foreground italic">
                    Sem etapas configuradas
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelSeries} layout="vertical">
                      <defs>
                        <linearGradient id="grFunnel" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="var(--color-chart-2)" />
                          <stop offset="100%" stopColor="var(--color-primary)" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        stroke="var(--color-muted-foreground)"
                        fontSize={10}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="var(--color-muted-foreground)"
                        fontSize={10}
                        width={86}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 12,
                          fontSize: 12,
                          boxShadow: "var(--shadow-elegant)",
                        }}
                      />
                      <Bar dataKey="count" fill="url(#grFunnel)" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Modules grid */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <h3 className="font-bold font-display text-lg">Módulos do CRM</h3>
                <p className="text-xs text-muted-foreground">Acesse cada área da experiência</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modules.map((m) => (
                <FeatureCard
                  key={m.url}
                  to={m.url}
                  icon={m.icon}
                  title={m.title}
                  description={m.desc}
                  tone={m.tone}
                />
              ))}
            </div>
          </div>

          {/* Recent leads */}
          <div className="relative overflow-hidden bg-card border border-border rounded-2xl shadow-card">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
            />
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold font-display flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" /> Leads recentes
                </h3>
                <p className="text-xs text-muted-foreground">Últimos contatos cadastrados</p>
              </div>
              <Link
                to="/leads"
                className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
              >
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-2.5 w-20 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                ))
              ) : recentLeads.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nenhum lead ainda.{" "}
                    <Link to="/leads" className="text-primary font-bold hover:underline">
                      Cadastre o primeiro
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                recentLeads.map((l) => {
                  const src = sourceFor(l.source);
                  const SrcIcon = src.icon;
                  const statusCls = statusMeta[l.status] || statusMeta.novo;
                  const cleanPhone = (l.phone || "").replace(/\D/g, "");
                  return (
                    <div
                      key={l.id}
                      className="px-5 py-3 flex items-center gap-4 hover:bg-accent/40 transition-colors group"
                    >
                      <div className="h-10 w-10 rounded-xl bg-gradient-primary text-white grid place-items-center text-xs font-bold shadow-sm ring-1 ring-inset ring-white/15">
                        {l.name
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .slice(0, 2)
                          .join("") || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{l.name || "Sem nome"}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Phone className="h-3 w-3" />
                          {l.phone || "—"}
                        </div>
                      </div>
                      <span
                        className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${src.class}`}
                      >
                        <SrcIcon className="h-3 w-3" /> {src.label}
                      </span>
                      <span
                        className={`hidden md:inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ring-inset ${statusCls}`}
                      >
                        {(l.status || "novo").replace("_", " ")}
                      </span>
                      <span className="hidden lg:inline text-[10px] text-muted-foreground tabular-nums">
                        {new Date(l.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {cleanPhone && (
                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir no WhatsApp"
                            className="h-8 w-8 grid place-items-center rounded-lg bg-success/10 text-success hover:bg-success/20 transition"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </a>
                        )}
                        <Link
                          to="/leads"
                          title="Abrir lead"
                          className="h-8 w-8 grid place-items-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Customer experience tips */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative overflow-hidden bg-gradient-to-br from-primary/8 to-transparent border border-primary/20 rounded-2xl p-6 shadow-sm">
              <div
                aria-hidden
                className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/15 blur-2xl"
              />
              <div className="relative flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center ring-1 ring-inset ring-primary/20">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Dica de Experiência</h3>
                  <p className="text-xs text-muted-foreground">Otimize sua conversão</p>
                </div>
              </div>
              <p className="relative text-sm leading-relaxed text-foreground/85">
                Clientes que recebem resposta nos primeiros <strong>5 minutos</strong> têm 10× mais
                chances de converter.
              </p>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-success/8 to-transparent border border-success/20 rounded-2xl p-6 shadow-sm">
              <div
                aria-hidden
                className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-success/15 blur-2xl"
              />
              <div className="relative flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-success/15 text-success grid place-items-center ring-1 ring-inset ring-success/20">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Saúde da Carteira</h3>
                  <p className="text-xs text-muted-foreground">Engajamento dos clientes</p>
                </div>
              </div>
              <div className="relative">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground font-medium">Taxa de conversão</span>
                  <span className="font-bold tabular-nums">{conversionRate.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-success/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-success to-primary transition-all duration-700"
                    style={{ width: `${Math.min(conversionRate, 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-foreground/70">
                  {conversionRate >= 30
                    ? "Excelente — mantenha o ritmo!"
                    : conversionRate >= 15
                      ? "Bom desempenho, há espaço para crescer."
                      : conversionRate >= 5
                        ? "Regular — revise objeções no funil."
                        : "Em construção — gere mais leads qualificados."}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-gradient-to-br from-info/8 to-transparent border border-info/20 rounded-2xl p-6 shadow-sm">
              <div
                aria-hidden
                className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-info/15 blur-2xl"
              />
              <div className="relative flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-info/15 text-info grid place-items-center ring-1 ring-inset ring-info/20">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Ticket Médio</h3>
                  <p className="text-xs text-muted-foreground">Pipeline / leads</p>
                </div>
              </div>
              <p className="relative text-2xl font-black font-display text-info">
                R${" "}
                {ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 text-xs text-foreground/70">
                Eleve o ticket com kits, upsell e garantias estendidas.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-[11px] font-semibold text-white/95">
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

const toneMap: Record<string, { icon: string; ring: string; gradient: string; trend: string }> = {
  primary: {
    icon: "bg-primary/10 text-primary",
    ring: "ring-primary/20",
    gradient: "from-primary/10 to-transparent",
    trend: "text-primary",
  },
  success: {
    icon: "bg-success/10 text-success",
    ring: "ring-success/20",
    gradient: "from-success/10 to-transparent",
    trend: "text-success",
  },
  info: {
    icon: "bg-info/10 text-info",
    ring: "ring-info/20",
    gradient: "from-info/10 to-transparent",
    trend: "text-info",
  },
  warning: {
    icon: "bg-warning/15 text-[oklch(0.55_0.15_75)]",
    ring: "ring-warning/25",
    gradient: "from-warning/10 to-transparent",
    trend: "text-[oklch(0.55_0.15_75)]",
  },
  violet: {
    icon: "bg-accent text-accent-foreground",
    ring: "ring-accent/40",
    gradient: "from-accent/40 to-transparent",
    trend: "text-accent-foreground",
  },
};

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
  hint,
  trend,
}: {
  icon: any;
  label: string;
  value: string;
  tone: keyof typeof toneMap;
  hint?: string;
  trend?: number;
}) {
  const t = toneMap[tone] ?? toneMap.primary;
  const trendUp = (trend ?? 0) >= 0;
  return (
    <div
      className={`group relative overflow-hidden bg-card border border-border rounded-2xl p-4 shadow-card hover:shadow-elegant hover:-translate-y-0.5 transition-all duration-300 ring-0 hover:ring-2 ${t.ring}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
      />
      <div
        aria-hidden
        className={`absolute inset-0 bg-gradient-to-br ${t.gradient} opacity-40 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
      />
      <div className="relative flex items-center gap-2 mb-3">
        <div
          className={`h-9 w-9 rounded-xl grid place-items-center shadow-sm ring-1 ring-inset ring-current/15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg] ${t.icon}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="relative flex items-baseline gap-2">
        <span className="text-[22px] font-bold font-display tracking-tight truncate">{value}</span>
        {typeof trend === "number" && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ring-inset whitespace-nowrap ${
              trendUp
                ? "bg-success/10 text-success ring-success/20"
                : "bg-destructive/10 text-destructive ring-destructive/20"
            }`}
          >
            {trendUp ? "↑" : "↓"} {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      {hint && <div className="relative text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
