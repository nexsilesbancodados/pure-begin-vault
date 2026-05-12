import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { parseOfx, type OfxTx } from "@/lib/ofx";
import { toast } from "sonner";

export const Route = createFileRoute("/conciliacao")({
  component: ConciliacaoPage,
});

type AccountRow = {
  id: string;
  description: string;
  amount: number;
  paid_amount: number | null;
  due_date: string;
  status: string;
  kind: "receivable" | "payable";
};

type Match = {
  tx: OfxTx;
  account?: AccountRow;
  confidence: number; // 0..1
};

function ConciliacaoPage() {
  const { orgId, userId } = useOrg();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [txs, setTxs] = useState<OfxTx[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleFile = async (file: File) => {
    if (!orgId) return;
    setProcessing(true);
    try {
      const content = await file.text();
      const parsed = parseOfx(content);
      if (parsed.length === 0) {
        toast.error("Nenhuma transação encontrada no OFX");
        return;
      }
      setTxs(parsed);

      // carrega receivable+payable em aberto
      const [recRes, payRes] = await Promise.all([
        supabase
          .from("accounts_receivable")
          .select("id, description, amount, paid_amount, due_date, status")
          .eq("organization_id", orgId)
          .neq("status", "paid")
          .limit(2000),
        supabase
          .from("accounts_payable")
          .select("id, description, amount, paid_amount, due_date, status")
          .eq("organization_id", orgId)
          .neq("status", "paid")
          .limit(2000),
      ]);
      const list: AccountRow[] = [
        ...((recRes.data ?? []) as any[]).map((a) => ({ ...a, kind: "receivable" as const })),
        ...((payRes.data ?? []) as any[]).map((a) => ({ ...a, kind: "payable" as const })),
      ];
      setAccounts(list);

      // matching
      const matched: Match[] = parsed.map((tx) => {
        // candidatos do tipo correto (credit→receivable, debit→payable)
        const candidates = list.filter((a) =>
          tx.type === "credit" ? a.kind === "receivable" : a.kind === "payable"
        );
        let best: { account: AccountRow; score: number } | null = null;
        for (const a of candidates) {
          const remaining = Number(a.amount) - Number(a.paid_amount ?? 0);
          if (remaining <= 0) continue;
          const valueDiff = Math.abs(remaining - tx.amount);
          if (valueDiff > Math.max(0.5, remaining * 0.05)) continue;

          const dueDays = Math.abs(
            (new Date(a.due_date).getTime() - new Date(tx.date).getTime()) / 86400000
          );
          if (dueDays > 30) continue;

          // score: 1 - (valueDiff/100) - (dueDays/30) * 0.3
          const score = 1 - valueDiff / Math.max(remaining, 1) - (dueDays / 30) * 0.3;
          if (!best || score > best.score) best = { account: a, score };
        }
        return {
          tx,
          account: best?.account,
          confidence: best?.score ?? 0,
        };
      });
      setMatches(matched);
      toast.success(`${parsed.length} transações lidas, ${matched.filter((m) => m.account).length} casadas`);
    } finally {
      setProcessing(false);
    }
  };

  const stats = useMemo(() => {
    const high = matches.filter((m) => m.account && m.confidence >= 0.85).length;
    const low = matches.filter((m) => m.account && m.confidence < 0.85).length;
    const none = matches.filter((m) => !m.account).length;
    return { high, low, none };
  }, [matches]);

  const applyMatch = async (m: Match) => {
    if (!m.account || !user?.id) return;
    const table = m.account.kind === "receivable" ? "accounts_receivable" : "accounts_payable";
    const newPaid = (Number(m.account.paid_amount ?? 0) + m.tx.amount);
    const totalDue = Number(m.account.amount);
    const status = newPaid >= totalDue ? "paid" : "partial";

    const { error } = await supabase
      .from(table as any)
      .update({
        paid_amount: newPaid,
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", m.account.id);

    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Baixa registrada");
    setMatches((prev) => prev.filter((x) => x !== m));
  };

  const applyAll = async () => {
    const auto = matches.filter((m) => m.account && m.confidence >= 0.85);
    if (auto.length === 0) { toast.error("Sem matches de alta confiança"); return; }
    if (!confirm(`Aplicar ${auto.length} baixa(s) automática(s)?`)) return;
    for (const m of auto) await applyMatch(m);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Conciliação bancária" subtitle="Importar OFX e casar com a receber/pagar" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
              <Banknote className="h-4 w-4" /> Importar extrato
            </h3>
            <input
              ref={fileRef}
              type="file"
              accept=".ofx,.qfx,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={processing}>
              <Upload className="h-4 w-4 mr-2" />
              {processing ? "Lendo..." : "Escolher arquivo OFX"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Baixe o OFX do seu banco (Itaú, Bradesco, NuBank etc) e importe aqui. Vamos casar com as
              contas a receber/pagar pendentes automaticamente.
            </p>
          </Card>

          {txs.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Kpi label="Alta confiança" value={stats.high} color="success" />
                <Kpi label="Confiança baixa" value={stats.low} color="warning" />
                <Kpi label="Sem match" value={stats.none} color="destructive" />
              </div>

              {stats.high > 0 && (
                <Button onClick={applyAll} className="w-full">
                  Aplicar {stats.high} baixa(s) automática(s)
                </Button>
              )}

              <Card className="p-5">
                <h3 className="font-black text-sm uppercase tracking-widest mb-3">
                  Transações ({txs.length})
                </h3>
                <div className="space-y-2">
                  {matches.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              m.tx.type === "credit"
                                ? "bg-success/15 text-success"
                                : "bg-destructive/15 text-destructive"
                            }
                          >
                            {m.tx.type === "credit" ? "Crédito" : "Débito"}
                          </Badge>
                          <span className="font-black text-sm">
                            R$ {m.tx.amount.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(m.tx.date).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {m.tx.memo}
                        </p>
                      </div>

                      {m.account ? (
                        <>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="min-w-0 max-w-[40%]">
                            <div className="flex items-center gap-2">
                              <Badge
                                className={
                                  m.confidence >= 0.85
                                    ? "bg-success/15 text-success"
                                    : "bg-warning/15 text-warning"
                                }
                              >
                                {(m.confidence * 100).toFixed(0)}%
                              </Badge>
                              <p className="text-xs font-bold truncate">
                                {m.account.description}
                              </p>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              Vence {new Date(m.account.due_date).toLocaleDateString("pt-BR")} ·
                              R$ {Number(m.account.amount).toFixed(2)}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => applyMatch(m)}>
                            Baixar
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Sem match
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "success" | "warning" | "destructive";
}) {
  const colors = {
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
  };
  return (
    <Card className={`p-4 ${colors[color]}`}>
      <p className="text-[10px] uppercase tracking-widest font-black opacity-70">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </Card>
  );
}
