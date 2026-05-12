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
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  PlayCircle,
  StopCircle,
  Plus,
  Minus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/caixa-pdv")({
  component: CaixaPdvPage,
});

type Session = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  status: string;
};

type Movement = {
  id: string;
  type: string; // 'sangria' | 'reforco' | 'venda' | 'troco'
  amount: number;
  description: string | null;
  created_at: string;
};

function CaixaPdvPage() {
  const { orgId, userId } = useOrg();
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAmount, setOpenAmount] = useState("0");
  const [movAmount, setMovAmount] = useState("");
  const [movDesc, setMovDesc] = useState("");

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data: sess } = await supabase
      .from("cash_register_sessions")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSession((sess as Session) ?? null);
    if (sess) {
      const { data: movs } = await supabase
        .from("cash_register_movements")
        .select("*")
        .eq("session_id", (sess as any).id)
        .order("created_at", { ascending: false });
      setMovements((movs as Movement[]) ?? []);
    } else {
      setMovements([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  const totals = useMemo(() => {
    const t = { entradas: 0, saidas: 0 };
    for (const m of movements) {
      const v = Number(m.amount);
      if (m.type === "sangria" || m.type === "saida") t.saidas += v;
      else t.entradas += v;
    }
    const opening = session ? Number(session.opening_amount ?? 0) : 0;
    return {
      ...t,
      saldo: opening + t.entradas - t.saidas,
      opening,
    };
  }, [movements, session]);

  const openSession = async () => {
    if (!orgId || !userId) return;
    const opening = parseFloat(openAmount.replace(",", ".")) || 0;
    const { error } = await supabase
      .from("cash_register_sessions")
      .insert({
        organization_id: orgId,
        user_id: userId,
        opening_amount: opening,
        status: "open",
      } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Caixa aberto");
    load();
  };

  const closeSession = async () => {
    if (!session) return;
    if (!confirm(`Fechar o caixa com saldo de R$ ${totals.saldo.toFixed(2)}?`)) return;
    const { error } = await supabase
      .from("cash_register_sessions")
      .update({
        status: "closed",
        closed_at: new Date().toISOString(),
        closing_amount: totals.saldo,
      } as any)
      .eq("id", session.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Caixa fechado");
    load();
  };

  const addMovement = async (type: "sangria" | "reforco") => {
    if (!session || !orgId || !userId) return;
    const v = parseFloat(movAmount.replace(",", "."));
    if (!v || v <= 0) { toast.error("Valor inválido"); return; }

    const { error } = await supabase
      .from("cash_register_movements")
      .insert({
        organization_id: orgId,
        user_id: userId,
        session_id: session.id,
        type,
        amount: v,
        description: movDesc.trim() || null,
      } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(type === "sangria" ? "Sangria registrada" : "Reforço registrado");
    setMovAmount("");
    setMovDesc("");
    load();
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Caixa PDV" subtitle="Sangria, reforço e fechamento" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Carregando...
            </Card>
          ) : !session ? (
            <Card className="p-6 max-w-md mx-auto">
              <h3 className="font-black mb-3 flex items-center gap-2">
                <PlayCircle className="h-5 w-5 text-primary" /> Abrir caixa
              </h3>
              <Label htmlFor="open">Valor inicial em caixa (troco)</Label>
              <Input
                id="open"
                type="number"
                step="0.01"
                value={openAmount}
                onChange={(e) => setOpenAmount(e.target.value)}
                placeholder="0.00"
                className="text-lg font-bold"
              />
              <Button onClick={openSession} className="w-full mt-4">
                Abrir caixa
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Ao abrir, todas as vendas do PDV serão lançadas neste caixa até você fechar.
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi
                  icon={Wallet}
                  label="Saldo atual"
                  value={`R$ ${totals.saldo.toFixed(2)}`}
                  color="primary"
                />
                <Kpi icon={ArrowUpCircle} label="Entradas" value={`R$ ${totals.entradas.toFixed(2)}`} color="success" />
                <Kpi icon={ArrowDownCircle} label="Saídas" value={`R$ ${totals.saidas.toFixed(2)}`} color="destructive" />
                <Kpi
                  icon={PlayCircle}
                  label="Abertura"
                  value={`R$ ${totals.opening.toFixed(2)}`}
                  color="primary"
                />
              </div>

              <Card className="p-5">
                <h3 className="font-black text-sm uppercase tracking-widest mb-3">
                  Lançar movimento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-3">
                    <Label htmlFor="mov-amt">Valor</Label>
                    <Input
                      id="mov-amt"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={movAmount}
                      onChange={(e) => setMovAmount(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-5">
                    <Label htmlFor="mov-desc">Motivo</Label>
                    <Input
                      id="mov-desc"
                      placeholder="Ex: pagamento fornecedor"
                      value={movDesc}
                      onChange={(e) => setMovDesc(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-4 flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => addMovement("sangria")}
                    >
                      <Minus className="h-4 w-4 mr-1" /> Sangria
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-success text-success hover:bg-success/10"
                      onClick={() => addMovement("reforco")}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Reforço
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-sm uppercase tracking-widest">
                    Movimentações
                  </h3>
                  <Badge variant="outline">{movements.length}</Badge>
                </div>
                {movements.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhuma movimentação registrada ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {movements.map((m) => {
                      const isOut = m.type === "sangria" || m.type === "saida";
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-border"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isOut ? (
                              <ArrowDownCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <ArrowUpCircle className="h-5 w-5 text-success" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-bold capitalize">
                                {m.type}
                              </p>
                              {m.description && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {m.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-black ${
                                isOut ? "text-destructive" : "text-success"
                              }`}
                            >
                              {isOut ? "-" : "+"} R$ {Number(m.amount).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(m.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive/10"
                onClick={closeSession}
              >
                <StopCircle className="h-4 w-4 mr-2" /> Fechar caixa (saldo R$ {totals.saldo.toFixed(2)})
              </Button>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: "primary" | "success" | "destructive";
}) {
  const colors = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            {label}
          </div>
          <div className="text-lg font-black truncate">{value}</div>
        </div>
      </div>
    </Card>
  );
}
