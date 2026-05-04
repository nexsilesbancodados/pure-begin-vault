import { ArrowRight, Send, CheckCircle2, MessageSquare, Zap, ChevronLeft, ChevronRight, Loader2, PauseCircle } from "lucide-react";
import { useState, useEffect } from "react";
 import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TasksCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "completed")
        .limit(5);
      
      setTasksList(data || []);
      setLoading(false);
    })();
  }, [user?.id]);

  const toggleTask = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "pending" : "completed";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", id);
    setTasksList(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <h3 className="text-[15px] font-semibold mb-3">Tarefas do dia</h3>
      {loading ? (
        <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/20" /></div>
      ) : (
        <ul className="space-y-2">
          {tasksList.length > 0 ? tasksList.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition">
              <input 
                type="checkbox" 
                checked={t.status === "completed"} 
                onChange={() => toggleTask(t.id, t.status)}
                className="h-4 w-4 rounded border-border accent-primary" 
              />
              <span className="flex-1 text-[13px] truncate">{t.title}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${t.priority === 'high' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {t.priority === 'high' ? 'Alta' : 'Normal'}
              </span>
            </li>
          )) : (
            <li className="text-center py-6 text-xs text-muted-foreground italic">Sem tarefas pendentes</li>
          )}
        </ul>
      )}
       <button 
        onClick={() => navigate({ to: "/atendimento" })}
         className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-muted rounded-lg py-2 transition"
       >
         Ver todas as tarefas <ArrowRight className="h-3.5 w-3.5" />
       </button>
    </div>
  );
}

  export function AutomationsCard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [automationList, setAutomationList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (!user?.id) return;
      (async () => {
        const { data } = await supabase
          .from("automations")
          .select("*")
          .eq("user_id", user.id)
          .limit(3);
        setAutomationList(data || []);
        setLoading(false);
      })();
    }, [user?.id]);

   return (
     <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
       <div className="flex items-center justify-between mb-3">
         <h3 className="text-[15px] font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-warning" /> Automação</h3>
         <span className="text-[11px] font-semibold text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">{automationList.filter(a => a.is_active).length} Ativas</span>
       </div>
       {loading ? (
         <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/20" /></div>
       ) : (
         <ul className="space-y-2.5">
           {automationList.length > 0 ? automationList.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3 hover:shadow-card transition">
                <div className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${a.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {a.is_active ? <CheckCircle2 className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold truncate">{a.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${a.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"} font-semibold`}>{a.is_active ? 'Ativa' : 'Pausada'}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-tighter">{a.trigger_type}</div>
                </div>
              </li>
            )) : (
             <li className="text-center py-6 text-xs text-muted-foreground italic border border-dashed border-border rounded-xl">Nenhuma automação configurada</li>
            )}
         </ul>
       )}
       <button 
         onClick={() => navigate({ to: "/automacao" })}
         className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-muted rounded-lg py-2 transition"
       >
         Ver todas as automações <ArrowRight className="h-3.5 w-3.5" />
       </button>
    </div>
  );
}

 export function AgendaCard() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const [events, setEvents] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [m] = useState(new Date());
  const days = ["D","S","T","Q","Q","S","S"];
  const monthName = m.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

   useEffect(() => {
     if (!user?.id) return;
     (async () => {
       const { data } = await supabase
         .from("calendar_events")
         .select("*")
         .eq("user_id", user.id)
         .gte("start_time", new Date().toISOString())
         .order("start_time", { ascending: true })
         .limit(3);
       setEvents(data || []);
       setLoading(false);
     })();
   }, [user?.id]);

  const grid = Array.from({ length: 35 }, (_, i) => i - 3);
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <h3 className="text-[15px] font-semibold mb-3">Compromissos</h3>
      <div className="flex items-center justify-between mb-2">
        <button className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-[13px] font-semibold capitalize">{monthName}</span>
        <button className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground mb-1">
        {days.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11.5px]">
        {grid.map((n) => {
          const day = n;
          const valid = day >= 1 && day <= 31;
          const today = day === 24;
          return (
            <span key={n} className={`h-7 grid place-items-center rounded-md ${today ? "bg-primary text-primary-foreground font-bold" : valid ? "hover:bg-muted cursor-pointer" : "text-muted-foreground/40"}`}>
              {valid ? day : ""}
            </span>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-border min-h-[100px]">
        <div className="text-[12px] font-semibold mb-2">Próximos Compromissos</div>
        {loading ? (
          <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground/20" /></div>
        ) : (
          <ul className="space-y-1.5">
            {events.length > 0 ? events.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-[12px]">
                <span className="text-primary font-semibold w-10 shrink-0">{format(new Date(a.start_time), "HH:mm")}</span>
                <span className="text-foreground/85 truncate">{a.title}</span>
              </li>
            )) : (
              <li className="text-center py-4 text-xs text-muted-foreground italic">Sem compromissos hoje</li>
            )}
          </ul>
        )}
         <button 
            onClick={() => navigate({ to: "/atendimento" })}
           className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-muted rounded-lg py-2 transition"
         >
           Ver agenda completa <ArrowRight className="h-3.5 w-3.5" />
         </button>
      </div>
    </div>
  );
}

 export function DispatchCard() {
   const navigate = useNavigate();
   const { user } = useAuth();
   const [stats, setStats] = useState({ total: 0, sent: 0, received: 0 });

   useEffect(() => {
     if (!user?.id) return;
     (async () => {
       const today = new Date();
       today.setHours(0,0,0,0);
       const { count: total, error: totalErr } = await supabase.from("messages").select("*", { count: 'exact', head: true }).eq("user_id", user.id).gte("created_at", today.toISOString());
       const { count: sent } = await supabase.from("messages").select("*", { count: 'exact', head: true }).eq("user_id", user.id).eq("direction", "outgoing").gte("created_at", today.toISOString());
       const { count: received, error: recvErr } = await supabase.from("messages").select("*", { count: 'exact', head: true }).eq("user_id", user.id).eq("direction", "incoming").gte("created_at", today.toISOString());
       setStats({ total: total || 0, sent: sent || 0, received: received || 0 });
     })();
   }, [user?.id]);

   const items = [
     { icon: Send, label: "Total de hoje", value: String(stats.total), color: "var(--color-primary)" },
     { icon: CheckCircle2, label: "Enviadas", value: String(stats.sent), sub: `(${stats.total > 0 ? Math.round((stats.sent/stats.total)*100) : 0}%)`, color: "var(--color-success)" },
     { icon: MessageSquare, label: "Recebidas", value: String(stats.received), sub: `(${stats.total > 0 ? Math.round((stats.received/stats.total)*100) : 0}%)`, color: "oklch(0.65 0.2 330)" },
   ];
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <h3 className="text-[15px] font-semibold mb-3">Disparos de hoje</h3>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.label} className="text-center">
              <div className="h-10 w-10 mx-auto rounded-xl grid place-items-center mb-1.5" style={{ background: `color-mix(in oklab, ${it.color} 15%, transparent)`, color: it.color }}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-[10.5px] text-muted-foreground leading-tight">{it.label}</div>
              <div className="font-bold font-display text-[15px] mt-0.5">{it.value} {it.sub && <span className="text-[10px] text-success font-semibold">{it.sub}</span>}</div>
            </div>
          );
        })}
      </div>
       <button 
         onClick={() => navigate({ to: "/relatorios" })}
         className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-muted rounded-lg py-2 transition"
       >
         Ver relatórios completos <ArrowRight className="h-3.5 w-3.5" />
       </button>
    </div>
  );
}
