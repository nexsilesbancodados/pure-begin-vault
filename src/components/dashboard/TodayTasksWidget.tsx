import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ListTodo } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Tpl {
  id: string;
  title: string;
  priority: string;
  done: boolean;
}

export function TodayTasksWidget() {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const [rows, setRows] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId || !user?.id) return;
    let cancel = false;
    const today = format(new Date(), "yyyy-MM-dd");
    (async () => {
      setLoading(true);
      const [{ data: tpls }, { data: comps }] = await Promise.all([
        supabase
          .from("daily_task_templates")
          .select("id, title, priority, position")
          .eq("organization_id", orgId)
          .eq("is_active", true)
          .order("position"),
        supabase
          .from("daily_task_completions")
          .select("template_id")
          .eq("organization_id", orgId)
          .eq("user_id", user.id)
          .eq("date", today),
      ]);
      const done = new Set((comps ?? []).map((c: any) => c.template_id));
      if (cancel) return;
      setRows(
        (tpls ?? []).map((t: any) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          done: done.has(t.id),
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [orgId, user?.id]);

  const completed = rows.filter((r) => r.done).length;
  const pct = rows.length ? Math.round((completed / rows.length) * 100) : 0;

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          <h3 className="font-bold">Tarefas de Hoje</h3>
        </div>
        <Link
          to="/calendario"
          className="text-xs text-primary hover:underline font-semibold"
        >
          Abrir Kanban →
        </Link>
      </div>
      {!loading && rows.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{completed} de {rows.length} concluídas</span>
            <span className="font-bold text-foreground">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma tarefa diária cadastrada.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-[220px] overflow-y-auto">
          {rows.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${
                r.done ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              {r.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="truncate">{r.title}</span>
              {r.priority === "high" && (
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-bold">
                  ALTA
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
