import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Smile, Meh, Frown, Send, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/nps")({
  head: () => ({
    meta: [
      { title: "NPS — Pesquisa de Satisfação | ConectaCRM" },
      { name: "description", content: "Net Promoter Score — meça a satisfação dos seus clientes" },
    ],
  }),
  component: NpsPage,
});

type Resp = { id: string; score: number; comment: string | null; created_at: string };

function NpsPage() {
  const { user, profile } = useAuth();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.organization_id) { setLoading(false); return; }
    const { data } = await supabase
      .from("nps_responses" as any)
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(100);
    setResponses((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.organization_id]);

  const submit = async () => {
    if (score === null || !user?.id) return;
    setSending(true);
    const { error } = await supabase.from("nps_responses" as any).insert({
      user_id: user.id,
      organization_id: profile?.organization_id,
      score,
      comment: comment.trim() || null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Obrigado pelo feedback!");
    setScore(null); setComment("");
    load();
  };

  const promoters = responses.filter((r) => r.score >= 9).length;
  const passives = responses.filter((r) => r.score >= 7 && r.score <= 8).length;
  const detractors = responses.filter((r) => r.score <= 6).length;
  const total = responses.length;
  const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <Topbar title="NPS — Net Promoter Score" subtitle="Como seus clientes recomendariam você" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="text-[11px] uppercase font-bold text-muted-foreground">NPS</div>
              <div className={`text-4xl font-bold font-display mt-2 ${npsScore >= 50 ? "text-success" : npsScore >= 0 ? "text-warning" : "text-destructive"}`}>{npsScore}</div>
              <div className="text-xs text-muted-foreground mt-1">{npsScore >= 70 ? "Excelente" : npsScore >= 50 ? "Ótimo" : npsScore >= 0 ? "Regular" : "Crítico"}</div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-success"><Smile className="h-4 w-4" /><span className="text-[11px] uppercase font-bold">Promotores (9-10)</span></div>
              <div className="text-3xl font-bold font-display mt-2">{promoters}</div>
              <div className="text-xs text-muted-foreground">{total > 0 ? Math.round((promoters / total) * 100) : 0}%</div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-warning"><Meh className="h-4 w-4" /><span className="text-[11px] uppercase font-bold">Neutros (7-8)</span></div>
              <div className="text-3xl font-bold font-display mt-2">{passives}</div>
              <div className="text-xs text-muted-foreground">{total > 0 ? Math.round((passives / total) * 100) : 0}%</div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-destructive"><Frown className="h-4 w-4" /><span className="text-[11px] uppercase font-bold">Detratores (0-6)</span></div>
              <div className="text-3xl font-bold font-display mt-2">{detractors}</div>
              <div className="text-xs text-muted-foreground">{total > 0 ? Math.round((detractors / total) * 100) : 0}%</div>
            </div>
          </div>

          {/* Submit form */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg mb-1">Registrar resposta de cliente</h2>
            <p className="text-sm text-muted-foreground mb-4">"De 0 a 10, o quanto você recomendaria a nossa loja?"</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {Array.from({ length: 11 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setScore(i)}
                  className={`h-12 w-12 rounded-xl border-2 font-bold transition ${
                    score === i
                      ? i >= 9 ? "border-success bg-success text-white" : i >= 7 ? "border-warning bg-warning text-white" : "border-destructive bg-destructive text-white"
                      : "border-border hover:border-primary"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comentário do cliente (opcional)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm min-h-[80px] mb-3"
            />
            <button
              disabled={score === null || sending}
              onClick={submit}
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 inline-flex items-center gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Salvar resposta
            </button>
          </div>

          {/* History */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg">Histórico ({total})</h2>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            {loading ? <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> :
              responses.length === 0 ? <div className="text-sm text-muted-foreground text-center py-10">Sem respostas ainda</div> :
              <div className="space-y-2">
                {responses.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                    <div className={`h-10 w-10 rounded-lg grid place-items-center font-bold text-white ${r.score >= 9 ? "bg-success" : r.score >= 7 ? "bg-warning" : "bg-destructive"}`}>{r.score}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
                      {r.comment && <div className="text-sm mt-1">{r.comment}</div>}
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        </main>
      </div>
    </div>
  );
}
