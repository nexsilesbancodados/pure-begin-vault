import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Users, Building2, DollarSign, ShoppingCart, Wrench, TrendingUp, ShieldAlert, Copy, CheckCircle2, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin · ConectaCRM" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminPage,
});

type Data = {
  metrics: {
    total_users?: number;
    total_orgs?: number;
    active_subs?: number;
    trial_subs?: number;
    cancelled_subs?: number;
    mrr_cents?: number;
    sales_24h?: number;
    os_24h?: number;
  };
  plan_breakdown: Array<{ name: string; count: number; mrr_cents: number }>;
  recent_orgs: Array<{ id: string; name: string | null; created_at: string }>;
};

function AdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/admin-metrics", {
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
        });
        if (res.status === 403) { setError("Acesso restrito. Apenas super admin."); return; }
        if (!res.ok) { setError("Erro ao carregar"); return; }
        setData(await res.json());
      } catch {
        setError("Erro de conexão");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-md">
          <Lock className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-black">{error}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Para virar super admin, peça pro owner rodar no SQL Editor:
            <code className="block mt-1 text-[10px] font-mono bg-muted p-2 rounded">
              INSERT INTO super_admins (user_id) VALUES (auth.uid());
            </code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Admin SaaS" subtitle="Métricas globais — restrito a super admins" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi icon={DollarSign} label="MRR" value={`R$ ${((data.metrics.mrr_cents ?? 0) / 100).toLocaleString("pt-BR")}`} color="success" big />
                <Kpi icon={Users} label="Usuários" value={data.metrics.total_users ?? 0} />
                <Kpi icon={Building2} label="Lojas" value={data.metrics.total_orgs ?? 0} />
                <Kpi icon={TrendingUp} label="Ativos" value={data.metrics.active_subs ?? 0} color="success" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi icon={Users} label="Em trial" value={data.metrics.trial_subs ?? 0} color="warning" />
                <Kpi icon={ShieldAlert} label="Cancelados" value={data.metrics.cancelled_subs ?? 0} color="destructive" />
                <Kpi icon={ShoppingCart} label="Vendas 24h" value={data.metrics.sales_24h ?? 0} />
                <Kpi icon={Wrench} label="OS 24h" value={data.metrics.os_24h ?? 0} />
              </div>

              <Card className="p-5">
                <h3 className="font-black text-sm uppercase tracking-widest mb-3">
                  Receita por plano
                </h3>
                {data.plan_breakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem assinaturas ativas ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {data.plan_breakdown.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border">
                        <div>
                          <p className="font-bold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.count} assinante(s)</p>
                        </div>
                        <p className="font-black text-primary">
                          R$ {(p.mrr_cents / 100).toLocaleString("pt-BR")}/mês
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <SetupCard />

              <Card className="p-5">
                <h3 className="font-black text-sm uppercase tracking-widest mb-3">
                  Últimas lojas criadas
                </h3>
                <div className="space-y-2">
                  {data.recent_orgs.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{o.name ?? "Sem nome"}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{o.id.slice(0, 13)}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SetupCard() {
  const [copied, setCopied] = useState<string | null>(null);
  const supaUrl = (import.meta as any).env?.VITE_SUPABASE_URL ?? "https://irjzfrhvjrvvwnxygufo.supabase.co";
  const items = [
    {
      id: "mp-webhook",
      title: "Webhook Mercado Pago",
      desc: "Cole esta URL em mercadopago.com.br → Suas integrações → Webhooks → Adicionar nova → Eventos: payment + subscription",
      url: `${supaUrl}/functions/v1/mp-webhook`,
    },
    {
      id: "evo-webhook",
      title: "Webhook Evolution API",
      desc: "No painel da Evolution, configure este como webhook da sua instância (eventos messages.upsert + connection.update)",
      url: `${supaUrl}/functions/v1/bot-webhook`,
    },
    {
      id: "google-place",
      title: "Google Place ID (para reviews)",
      desc: "Pegue seu ID em developers.google.com/maps/documentation/places/web-service/place-id e cole em /google-reviews",
      url: "https://developers.google.com/maps/documentation/places/web-service/place-id",
    },
  ];
  const copy = (id: string, url: string) => {
    navigator.clipboard?.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-4 w-4 text-primary" />
        <h3 className="font-black text-sm uppercase tracking-widest">Setup de integrações</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">URLs e tokens que você precisa cadastrar nos serviços externos.</p>
      <div className="space-y-3">
        {items.map((i) => (
          <div key={i.id} className="p-3 rounded-xl border border-border">
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-sm">{i.title}</p>
              <button
                onClick={() => copy(i.id, i.url)}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-muted hover:bg-muted/70 font-bold"
              >
                {copied === i.id ? <CheckCircle2 className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {copied === i.id ? "Copiado" : "Copiar"}
              </button>
            </div>
            <code className="block text-[11px] font-mono bg-muted/40 p-2 rounded break-all">{i.url}</code>
            <p className="text-[11px] text-muted-foreground mt-1.5">{i.desc}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Kpi({ icon: Icon, label, value, color, big }: { icon: any; label: string; value: number | string; color?: "success" | "warning" | "destructive"; big?: boolean }) {
  const colors = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    default: "text-primary bg-primary/10",
  };
  const c = colors[color ?? "default"];
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${c}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
          <div className={`font-black truncate ${big ? "text-2xl" : "text-xl"}`}>{value}</div>
        </div>
      </div>
    </Card>
  );
}
