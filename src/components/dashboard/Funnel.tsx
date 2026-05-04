import { Trophy, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const channelIcon = (c: string) => c === "WhatsApp" ? "💬" : "📷";

export function Funnel() {
  const { user } = useAuth();
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data: stgs } = await supabase
        .from("funnel_stages")
        .select("*")
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });

      const { data: deals } = await supabase
        .from("pipeline_leads")
        .select(`
          *,
          leads (name, source)
        `)
        .eq("user_id", user.id);

      const formattedStages = (stgs || []).map(s => {
        const stageDeals = (deals || []).filter(d => d.stage_id === s.id);
        return {
          id: s.id,
          label: s.name,
          color: s.color || "#64748b",
          count: stageDeals.length,
          total: stageDeals.reduce((acc, curr) => acc + (Number(curr.deal_value) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          leads: stageDeals.slice(0, 3).map(d => ({
            name: d.leads?.name || "Desconhecido",
            channel: d.leads?.source || "Direto",
            avatar: (d.leads?.name || "U")[0].toUpperCase(),
            time: new Date(d.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          }))
        };
      });

      setStages(formattedStages);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <h3 className="text-[15px] font-semibold mb-4">Funil de Vendas</h3>
      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/20" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {stages.length > 0 ? stages.map((s) => (
            <div key={s.id} className="rounded-xl bg-muted/40 border border-border p-3">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[13px] font-semibold flex-1">{s.label}</span>
                {s.label.toLowerCase().includes("ganho") && <Trophy className="h-3.5 w-3.5 text-warning" />}
              </div>
              <div className="flex items-baseline justify-between text-[11px] mb-3">
                <span className="text-muted-foreground">{s.count} leads</span>
                <span className="font-semibold text-foreground">{s.total}</span>
              </div>
              <ul className="space-y-2">
                {s.leads.map((l: any, idx: number) => (
                  <li key={`${s.id}-${idx}`} className="flex items-center gap-2.5 rounded-lg bg-card border border-border p-2 hover:shadow-card transition">
                    <div className="relative h-8 w-8 rounded-full bg-gradient-primary grid place-items-center text-[10px] font-semibold text-white shrink-0">
                      {l.avatar}
                      <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">{channelIcon(l.channel)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-medium truncate leading-tight">{l.name}</div>
                      <div className="text-[10.5px] text-muted-foreground">{l.channel} · {l.time}</div>
                    </div>
                  </li>
                ))}
              </ul>
              {s.count > 3 && (
                <button className="mt-3 w-full text-[11px] text-muted-foreground hover:text-primary transition">+ Ver mais {s.count - 3}</button>
              )}
            </div>
          )) : (
            <div className="col-span-full py-12 text-center text-sm text-muted-foreground italic border border-dashed border-border rounded-xl">
              Nenhuma etapa do funil configurada
            </div>
          )}
        </div>
      )}
    </div>
  );
}
