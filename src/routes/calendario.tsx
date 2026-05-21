import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, Circle, LayoutGrid, Bell } from "lucide-react";
import { toast } from "sonner";
import { DayKanbanModal } from "@/components/calendar/DayKanbanModal";
import { RemindersModal, checkRemindersDueToday } from "@/components/calendar/RemindersModal";



export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — ConectaCRM" },
      { name: "description", content: "Agenda de tarefas, follow-ups e compromissos" },
    ],
  }),
  component: CalendarPage,
});

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  lead_id: string | null;
};

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function CalendarPage() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [cursor, setCursor] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reminderDays, setReminderDays] = useState<Map<number, { count: number; titles: string[] }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [kanbanOpen, setKanbanOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium" });


  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const start = startOfMonth(cursor).toISOString();
    const end = new Date(endOfMonth(cursor).getTime() + 86400000).toISOString();
    const baseT = supabase.from("tasks").select("*").gte("due_date", start).lte("due_date", end);
    const { data } = await (
      orgId ? baseT.eq("organization_id", orgId) : baseT.eq("user_id", user.id)
    ).order("due_date", { ascending: true });
    setTasks((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [user?.id, cursor]);

  useEffect(() => {
    if (!user?.id || !orgId) return;
    void checkRemindersDueToday({ userId: user.id, organizationId: orgId });
    (async () => {
      const { data } = await supabase
        .from("recurring_reminders" as any)
        .select("title, day_of_month, days_of_week, frequency, active")
        .eq("organization_id", orgId)
        .eq("active", true);
      const map = new Map<number, { count: number; titles: string[] }>();
      const start = startOfMonth(cursor);
      const end = endOfMonth(cursor);
      const addTo = (k: number, title: string) => {
        const cur = map.get(k) || { count: 0, titles: [] };
        cur.count += 1;
        cur.titles.push(title);
        map.set(k, cur);
      };
      ((data as any[]) || []).forEach((r) => {
        if (r.frequency === "weekly") {
          const dows: number[] = r.days_of_week || [];
          if (dows.length === 0) return;
          for (let d = 1; d <= end.getDate(); d++) {
            const dt = new Date(cursor.getFullYear(), cursor.getMonth(), d);
            if (dows.includes(dt.getDay())) addTo(d, r.title);
          }
        } else {
          const k = Number(r.day_of_month);
          if (k >= 1 && k <= end.getDate()) addTo(k, r.title);
        }
      });
      void start;
      setReminderDays(map);
    })();
  }, [user?.id, orgId, remindersOpen]);


  const days = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const arr: (Date | null)[] = [];
    for (let i = 0; i < start.getDay(); i++) arr.push(null);
    for (let d = 1; d <= end.getDate(); d++)
      arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const d = new Date(t.due_date);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    });
    return m;
  }, [tasks]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const selectedTasks = tasksByDay.get(dayKey(selected)) || [];

  const SUPER_EDITOR_EMAIL = "alfatech791@gmail.com";
  const isSuperEditor = (user?.email || "").trim().toLowerCase() === SUPER_EDITOR_EMAIL;
  const canEditDate = (d: Date) => {
    if (isSuperEditor) return true;
    const today = new Date();
    return (
      today.getFullYear() === d.getFullYear() &&
      today.getMonth() === d.getMonth() &&
      today.getDate() === d.getDate()
    );
  };

  const createTask = async () => {
    if (!canEditDate(selected)) {
      return toast.error("Somente o dia de hoje pode ser editado");
    }
    if (!form.title.trim() || !user?.id) return;
    const due = new Date(selected);
    due.setHours(9, 0, 0, 0);
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      organization_id: orgId,
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      status: "pending",
      due_date: due.toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada");
    setForm({ title: "", description: "", priority: "medium" });
    setModalOpen(false);
    load();
  };

  const toggleTask = async (t: Task) => {
    if (t.due_date && !canEditDate(new Date(t.due_date))) {
      return toast.error("Somente o dia de hoje pode ser editado");
    }
    const next = t.status === "done" ? "pending" : "done";
    await supabase.from("tasks").update({ status: next }).eq("id", t.id);
    load();
  };

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <Topbar title="Calendário" subtitle="Agenda de tarefas e follow-ups" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-xl capitalize">{monthLabel}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRemindersOpen(true)}
                    className="h-9 px-3 rounded-lg border border-border text-xs font-bold inline-flex items-center gap-1.5 hover:bg-muted text-primary"
                    title="Lembretes recorrentes (aluguel, contas mensais...)"
                  >
                    <Bell className="h-4 w-4" /> Lembretes
                  </button>
                  <button
                    onClick={() =>
                      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                    }
                    className="h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setCursor(new Date())}
                    className="h-9 px-3 rounded-lg border border-border text-sm font-bold hover:bg-muted"
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() =>
                      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                    }
                    className="h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-muted"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase font-bold text-muted-foreground mb-2">
                {WEEK.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="grid place-items-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d, i) => {
                    if (!d) return <div key={i} className="aspect-square" />;
                    const list = tasksByDay.get(dayKey(d)) || [];
                    const isToday = sameDay(d, new Date());
                    const isSelected = sameDay(d, selected);
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setSelected(d);
                          setKanbanOpen(true);
                        }}
                        className={`group relative aspect-square rounded-xl border text-left p-1.5 hover:border-primary hover:shadow-md transition ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className={`text-xs font-bold ${isToday ? "h-6 w-6 grid place-items-center rounded-full bg-primary text-primary-foreground" : ""}`}>
                            {d.getDate()}
                          </div>
                          <div className="flex items-center gap-1">
                            {reminderDays.get(d.getDate()) && (
                              <span
                                title={reminderDays.get(d.getDate())!.titles.join(" • ")}
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              >
                                <Bell className="h-2.5 w-2.5" />
                                {reminderDays.get(d.getDate())!.count}
                              </span>
                            )}
                            {list.length > 0 && (
                              <span className="text-[9px] font-bold px-1.5 rounded-full bg-primary/15 text-primary">
                                {list.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                          {list.slice(0, 2).map((t) => (
                            <div
                              key={t.id}
                              className={`text-[10px] truncate px-1 rounded ${t.status === "done" ? "bg-success/15 text-success line-through" : "bg-primary/15 text-primary"}`}
                            >
                              {t.title}
                            </div>
                          ))}
                          {list.length > 2 && (
                            <div className="text-[10px] text-muted-foreground">
                              +{list.length - 2}
                            </div>
                          )}
                        </div>
                        <div className="absolute inset-x-1 bottom-1 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                          <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-primary bg-primary/10 rounded-md py-0.5">
                            <LayoutGrid className="h-2.5 w-2.5" /> abrir quadro
                          </div>
                        </div>
                      </button>
                    );
                  })}

                </div>
              )}
            </div>

            {/* Day panel */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[11px] uppercase font-bold text-muted-foreground">
                    Dia selecionado
                  </div>
                  <div className="font-display font-bold text-lg capitalize">
                    {selected.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setKanbanOpen(true)}
                    className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90"
                    title="Abrir quadro Kanban do dia"
                  >
                    <LayoutGrid className="h-4 w-4" /> Quadro
                  </button>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-muted"
                    title="Nova tarefa rápida"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>


              <div className="space-y-2">
                {selectedTasks.length === 0 && (
                  <div className="text-sm text-muted-foreground py-8 text-center">
                    Sem tarefas neste dia
                  </div>
                )}
                {selectedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-2 p-3 rounded-lg border border-border hover:bg-muted/50"
                  >
                    <button onClick={() => toggleTask(t)} className="mt-0.5">
                      {t.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-bold text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}
                      >
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>
                      )}
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.priority === "high" ? "bg-destructive/15 text-destructive" : t.priority === "low" ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning"}`}
                    >
                      {t.priority === "high" ? "Alta" : t.priority === "low" ? "Baixa" : "Média"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold text-lg">
              Nova tarefa — {selected.toLocaleDateString("pt-BR")}
            </h3>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Título da tarefa"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
              autoFocus
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descrição (opcional)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm min-h-[80px]"
            />
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
            </select>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="h-10 px-4 rounded-lg border border-border text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={createTask}
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      <DayKanbanModal
        open={kanbanOpen}
        onClose={() => {
          setKanbanOpen(false);
          load();
        }}
        date={selected}
      />

      <RemindersModal open={remindersOpen} onClose={() => setRemindersOpen(false)} />
    </div>
  );

}
