import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function RecentService() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select(`
          *,
          leads (name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(2);
      
      setRecentMessages(data || []);
      setLoading(false);
    })();
  }, [user?.id]);

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <h3 className="text-[15px] font-semibold mb-3">Atendimentos recentes</h3>
      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/20" /></div>
      ) : (
        <ul className="space-y-2">
          {recentMessages.length > 0 ? recentMessages.map((m, idx) => (
            <li key={m.id || idx} className="flex items-start gap-3 rounded-xl border border-border p-3">
              <div className="relative shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-primary grid place-items-center text-white text-xs font-semibold">
                  {(m.leads?.name || "U").split(" ").map((s: string) => s[0]).slice(0,2).join("")}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-success`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold">{m.leads?.name || "Desconhecido"}</span>
                  <span className="text-[10.5px] text-muted-foreground">
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <span className="text-[10.5px] inline-block px-1.5 py-0.5 rounded bg-muted text-muted-foreground my-1">
                  WhatsApp
                </span>
                <p className="text-[12px] text-muted-foreground truncate">{m.content}</p>
              </div>
            </li>
          )) : (
            <li className="text-center py-8 text-xs text-muted-foreground italic border border-dashed border-border rounded-xl">Sem atendimentos recentes</li>
          )}
        </ul>
      )}
      <button 
        onClick={() => navigate({ to: "/atendimento" })}
        className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-muted rounded-lg py-2 transition"
      >
        Ir para Atendimento <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const etapaStyle = (e: string) => {
  switch (e) {
    case "Novo Contato": return "bg-info/15 text-info";
    case "Em Atendimento": return "bg-warning/20 text-[oklch(0.5_0.15_75)]";
    case "Proposta": return "bg-primary/15 text-primary";
    default: return "bg-muted text-muted-foreground";
  }
};

 export function RecentLeads() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const [leads, setLeads] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
     if (!user?.id) return;
     (async () => {
       // Fetch leads join with pipeline_leads to get etapa
       const { data } = await supabase
         .from("leads")
         .select(`
           *,
           pipeline_leads (
             funnel_stages (name)
           )
         `)
         .eq("user_id", user.id)
         .order("created_at", { ascending: false })
         .limit(5);

       setLeads((data || []).map(l => ({
         ...l,
         etapa: l.pipeline_leads?.[0]?.funnel_stages?.name || "Novo Contato"
       })));
       setLoading(false);
     })();
   }, [user?.id]);

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
       <div className="flex items-center justify-between mb-3">
         <h3 className="text-[15px] font-semibold">Leads recentes</h3>
         <button 
           onClick={() => navigate({ to: "/leads" })}
           className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
         >
           Ver todos <ArrowRight className="h-3 w-3" />
         </button>
       </div>
      <div className="overflow-x-auto min-h-[150px] relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/20" /></div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-muted-foreground text-[11px] uppercase tracking-wide">
                <th className="font-medium pb-2">Nome</th>
                <th className="font-medium pb-2">Origem</th>
                <th className="font-medium pb-2">Etapa</th>
                <th className="font-medium pb-2 text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.length > 0 ? leads.map((l, idx) => (
                <tr key={l.id || idx} className="hover:bg-muted/40 transition">
                  <td className="py-2.5 font-medium">{l.name}</td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-foreground/80">
                      <span className={`h-2 w-2 rounded-full ${l.source === "WhatsApp" ? "bg-success" : "bg-primary"}`} />
                      {l.source || "Direto"}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded ${etapaStyle(l.etapa)}`}>{l.etapa}</span>
                  </td>
                  <td className="py-2.5 text-right text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground italic">Sem leads captados recentemente</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
