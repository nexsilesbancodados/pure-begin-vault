import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Copy, Check, Users, DollarSign, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/afiliados")({
  component: AfiliadosPage,
});

function AfiliadosPage() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ referrals: 0, paid: 0, percent: 30 });
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data: codes } = await (supabase as any)
      .from("affiliate_codes")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (codes) {
      setCode(codes.code);
      setStats({
        referrals: codes.total_referrals,
        paid: codes.total_paid_cents / 100,
        percent: codes.commission_percent,
      });
    }
    const { data: refs } = await (supabase as any)
      .from("affiliate_referrals")
      .select("*")
      .eq("affiliate_user_id", user.id);
    setReferrals(refs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const generate = async () => {
    setGenerating(true);
    const { data, error } = await (supabase as any).rpc("create_affiliate_code");
    setGenerating(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    setCode(data);
    toast.success("Código gerado");
    load();
  };

  const fullLink = code ? `https://conectaphone.com/registro?ref=${code}` : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(fullLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success("Link copiado");
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title="Programa de Afiliados"
          subtitle="Indique outras lojas e ganhe comissão recorrente"
        />
        <main className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-4">
          <Card className="p-5 bg-gradient-to-br from-primary/10 to-card border-primary/30">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h2 className="font-black mb-1">Ganhe {stats.percent}% recorrente</h2>
                <p className="text-sm text-muted-foreground">
                  Pra cada loja que se cadastrar pelo seu link e virar cliente pagante, você ganha{" "}
                  <strong>{stats.percent}% da mensalidade</strong> dela enquanto ela for cliente.
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <Kpi icon={Users} label="Indicações" value={stats.referrals} />
            <Kpi icon={DollarSign} label="Recebido" value={`R$ ${stats.paid.toFixed(2)}`} />
            <Kpi icon={Award} label="Comissão" value={`${stats.percent}%`} />
          </div>

          {!code ? (
            <Card className="p-5 text-center">
              <Award className="h-10 w-10 text-primary mx-auto mb-3" />
              <h3 className="font-black mb-2">Gerar meu link de afiliado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Você ainda não tem um código. Gere agora e comece a compartilhar.
              </p>
              <Button onClick={generate} disabled={generating}>
                {generating ? "Gerando..." : "Gerar meu link"}
              </Button>
            </Card>
          ) : (
            <Card className="p-5">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                Seu link de indicação
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted/40 border border-border rounded font-mono text-xs break-all">
                  {fullLink}
                </code>
                <Button onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Código: <strong>{code}</strong> · Compartilhe no Instagram, grupos de lojistas,
                WhatsApp...
              </p>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3">
              Indicações ({referrals.length})
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Ainda sem indicações. Compartilhe seu link!
              </p>
            ) : (
              <div className="space-y-2">
                {referrals.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-border"
                  >
                    <div>
                      <p className="text-xs font-mono">{r.referred_user_id.slice(0, 13)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Desde {new Date(r.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge
                      className={
                        r.status === "active"
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {r.status === "active" ? "Ativo" : r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: any) {
  return (
    <Card className="p-3">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {label}
      </p>
      <p className="text-xl font-black">{value}</p>
    </Card>
  );
}
