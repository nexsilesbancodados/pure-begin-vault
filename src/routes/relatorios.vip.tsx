import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Award, TrendingDown, TrendingUp, AlertTriangle, Heart, Search, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { SkeletonList } from "@/components/ui/skeleton-loaders";
import { toast } from "sonner";

export const Route = createFileRoute("/relatorios/vip")({
  component: VipPage,
});

type RFM = {
  customer_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  freq: number;
  monetary: number;
  last_purchase: string | null;
  r_score: number;
  f_score: number;
  m_score: number;
  total_score: number;
  segment: string;
};

const SEGMENTS: Record<string, { label: string; color: string; icon: any; description: string }> = {
  champions: { label: "Campeões", color: "bg-success/15 text-success border-success/30", icon: Award, description: "Topo: compra recente, frequente e alto valor" },
  loyal: { label: "Leais", color: "bg-primary/15 text-primary border-primary/30", icon: Heart, description: "Frequentes e recentes" },
  big_spender: { label: "Grandes Gastadores", color: "bg-warning/15 text-warning border-warning/30", icon: TrendingUp, description: "Compra alto valor, recente" },
  new_customer: { label: "Novos", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: TrendingUp, description: "Comprou pela 1ª vez recentemente" },
  potential_loyal: { label: "Potencialmente Leais", color: "bg-primary/15 text-primary border-primary/30", icon: Heart, description: "Bons sinais — nurturing" },
  at_risk: { label: "Em Risco", color: "bg-warning/15 text-warning border-warning/30", icon: AlertTriangle, description: "Compraram bastante mas não voltam" },
  cant_lose: { label: "Não Perder", color: "bg-destructive/15 text-destructive border-destructive/30", icon: AlertTriangle, description: "Alto valor mas inativos — recuperar" },
  lost: { label: "Perdidos", color: "bg-muted text-muted-foreground border-border", icon: TrendingDown, description: "Provavelmente já churnaram" },
  regular: { label: "Regulares", color: "bg-card border-border", icon: Heart, description: "Comportamento mediano" },
  never_bought: { label: "Nunca compraram", color: "bg-muted text-muted-foreground border-border", icon: TrendingDown, description: "Cadastrados mas sem compras" },
};

function VipPage() {
  const { orgId } = useOrg();
  const [rfm, setRfm] = useState<RFM[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSegment, setFilterSegment] = useState<string>("all");
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (supabase as any)
      .from("customer_rfm")
      .select("*")
      .eq("organization_id", orgId)
      .order("total_score", { ascending: false })
      .limit(500)
      .then(({ data }: any) => {
        setRfm((data as RFM[]) ?? []);
        setLoading(false);
      });
  }, [orgId]);

  const filtered = useMemo(() => {
    let list = rfm;
    if (filterSegment !== "all") list = list.filter((r) => r.segment === filterSegment);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    return list;
  }, [rfm, filterSegment, search]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rfm) m[r.segment] = (m[r.segment] ?? 0) + 1;
    return m;
  }, [rfm]);

  const totalRevenue = useMemo(() => rfm.reduce((a, b) => a + Number(b.monetary), 0), [rfm]);

  const message = async (r: RFM) => {
    if (!r.phone) { toast.error("Cliente sem telefone"); return; }
    const segmentMsg: Record<string, string> = {
      champions: `Oi ${r.name.split(" ")[0]}! Você é um dos nossos clientes especiais. Temos uma oferta exclusiva pra você 🎁`,
      loyal: `Oi ${r.name.split(" ")[0]}, obrigado por sempre voltar! Que tal conferir nossas novidades?`,
      at_risk: `Oi ${r.name.split(" ")[0]}, faz tempo que não te vemos. Temos novidades especiais pra você ❤️`,
      cant_lose: `Oi ${r.name.split(" ")[0]}, sentimos sua falta! Cupom especial: 15% OFF na sua próxima compra.`,
      new_customer: `Oi ${r.name.split(" ")[0]}, bem-vindo! Qualquer dúvida estamos aqui.`,
    };
    const text = segmentMsg[r.segment] ?? `Oi ${r.name.split(" ")[0]}, dá uma olhada nas nossas novidades!`;
    setSending(r.customer_id);
    try {
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: { to: r.phone, text },
      });
      if (error) throw error;
      toast.success("Mensagem enviada");
    } catch (e: any) {
      toast.error("Falhou: " + e.message);
    } finally {
      setSending(null);
    }
  };

  const segmentOrder = ["champions", "loyal", "big_spender", "potential_loyal", "new_customer", "at_risk", "cant_lose", "regular", "lost", "never_bought"];

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Clientes VIP (RFM)" subtitle="Segmentação automática: Recency · Frequency · Monetary" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">
              <strong>RFM Score</strong> classifica clientes em 10 segmentos com base em:
              <strong> R</strong>ecência (última compra), <strong>F</strong>requência (qtd compras) e
              <strong> M</strong>onetário (total gasto). Use pra priorizar ofertas e reativações.
            </p>
          </Card>

          {/* Cards por segmento */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {segmentOrder.map((s) => {
              const cfg = SEGMENTS[s];
              const Icon = cfg.icon;
              const count = counts[s] ?? 0;
              const isActive = filterSegment === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterSegment(isActive ? "all" : s)}
                  className={`p-3 rounded-xl border text-left transition ${cfg.color} ${isActive ? "ring-2 ring-primary" : ""}`}
                  title={cfg.description}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase tracking-wider font-black">{cfg.label}</span>
                  </div>
                  <p className="text-xl font-black">{count}</p>
                </button>
              );
            })}
          </div>

          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente por nome..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {filterSegment !== "all" && (
                <Button variant="outline" size="sm" onClick={() => setFilterSegment("all")}>
                  Limpar filtro
                </Button>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-sm uppercase tracking-widest">
                Clientes ({filtered.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Receita total: <strong>R$ {totalRevenue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</strong>
              </p>
            </div>

            {loading ? (
              <SkeletonList rows={5} />
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {rfm.length === 0 ? "Sem clientes ainda. Cadastre em /clientes." : "Nenhum cliente no filtro."}
              </p>
            ) : (
              <div className="space-y-2">
                {filtered.slice(0, 100).map((r) => {
                  const cfg = SEGMENTS[r.segment] ?? SEGMENTS.regular;
                  return (
                    <div key={r.customer_id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold truncate">{r.name}</p>
                          <Badge className={`${cfg.color} text-[9px]`}>{cfg.label}</Badge>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            R{r.r_score} F{r.f_score} M{r.m_score} ={r.total_score}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.freq} compra(s) · R$ {Number(r.monetary).toFixed(0)}
                          {r.last_purchase && ` · última ${new Date(r.last_purchase).toLocaleDateString("pt-BR")}`}
                        </p>
                      </div>
                      {r.phone && (
                        <Button size="sm" variant="outline" onClick={() => message(r)} disabled={sending === r.customer_id}>
                          <Send className="h-3 w-3 mr-1" /> {sending === r.customer_id ? "..." : "Mensagem"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
