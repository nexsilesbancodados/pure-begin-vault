import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, XCircle, Clock, Loader2, Activity } from "lucide-react";

type Run = {
  id: string;
  trigger_type: string;
  action_type: string;
  status: string;
  payload: any;
  error: string | null;
  created_at: string;
};

export function AutomationLogs() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setRuns((data ?? []) as Run[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const icon = (s: string) =>
    s === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-success" />
    ) : s === "error" ? (
      <XCircle className="h-4 w-4 text-destructive" />
    ) : (
      <Clock className="h-4 w-4 text-warning" />
    );

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Últimas execuções</h3>
        </div>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground">
          Atualizar
        </button>
      </div>
      {loading ? (
        <div className="grid place-items-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : runs.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma execução ainda</div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y">
          {runs.map((r) => (
            <div key={r.id} className="p-3 flex items-start gap-3 text-sm hover:bg-muted/40">
              {icon(r.status)}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs">
                  <span className="text-muted-foreground">{r.trigger_type}</span> → {r.action_type}
                </div>
                {r.error && (
                  <div className="text-[11px] text-destructive mt-0.5 truncate">{r.error}</div>
                )}
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <span
                className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                  r.status === "success"
                    ? "bg-success/10 text-success"
                    : r.status === "error"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-warning/10 text-warning"
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
