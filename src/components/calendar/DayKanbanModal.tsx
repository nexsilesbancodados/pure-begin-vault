import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { useServerFn } from "@tanstack/react-start";
import { listOrgMembers, type OrgMember } from "@/lib/org-members.functions";
import {
  X,
  Plus,
  GripVertical,
  Loader2,
  Trash2,
  Flag,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

export type KanbanTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  board_order?: number | null;
};

type Column = { key: "todo" | "doing" | "done"; label: string; accent: string };

const COLUMNS: Column[] = [
  { key: "todo", label: "A fazer", accent: "from-slate-400/20 to-slate-400/5" },
  { key: "doing", label: "Em andamento", accent: "from-primary/25 to-primary/5" },
  { key: "done", label: "Concluído", accent: "from-emerald-400/25 to-emerald-400/5" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

function normalize(status: string): "todo" | "doing" | "done" {
  const s = (status || "").toLowerCase();
  if (s === "done" || s === "concluido" || s === "concluído" || s === "completed") return "done";
  if (s === "doing" || s === "in_progress" || s === "andamento") return "doing";
  return "todo";
}

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function DayKanbanModal({
  open,
  onClose,
  date,
}: {
  open: boolean;
  onClose: () => void;
  date: Date;
}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const fetchMembers = useServerFn(listOrgMembers);

  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", priority: "medium", assigned_to: "" });

  const dayStart = useMemo(() => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [date]);
  const dayEnd = useMemo(() => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [date]);

  const load = async () => {
    if (!user?.id || !open) return;
    setLoading(true);
    const base = supabase
      .from("tasks")
      .select("*")
      .gte("due_date", dayStart.toISOString())
      .lte("due_date", dayEnd.toISOString());
    const { data } = await (orgId
      ? base.eq("organization_id", orgId)
      : base.eq("user_id", user.id)
    ).order("board_order", { ascending: true });
    setTasks((data as KanbanTask[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    load();
    if (orgId) {
      fetchMembers({ data: { orgId } })
        .then((r) => setMembers(r.members || []))
        .catch(() => setMembers([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgId, dayStart.toISOString()]);

  const grouped = useMemo(() => {
    const m: Record<string, KanbanTask[]> = { todo: [], doing: [], done: [] };
    for (const t of tasks) m[normalize(t.status)].push(t);
    return m;
  }, [tasks]);

  const memberById = useMemo(() => {
    const m = new Map<string, OrgMember>();
    members.forEach((mm) => m.set(mm.user_id, mm));
    return m;
  }, [members]);

  const onDrop = async (col: Column["key"]) => {
    setHoverCol(null);
    if (!dragId) return;
    const t = tasks.find((x) => x.id === dragId);
    setDragId(null);
    if (!t || normalize(t.status) === col) return;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: col } : x)));
    const { error } = await supabase.from("tasks").update({ status: col }).eq("id", t.id);
    if (error) {
      toast.error("Falha ao mover");
      load();
    }
  };

  const createTask = async (col: Column["key"]) => {
    if (!draft.title.trim() || !user?.id) return;
    const due = new Date(date);
    due.setHours(9, 0, 0, 0);
    const payload: Record<string, unknown> = {
      user_id: user.id,
      organization_id: orgId,
      title: draft.title.trim(),
      priority: draft.priority,
      status: col,
      due_date: due.toISOString(),
    };
    if (draft.assigned_to) payload.assigned_to = draft.assigned_to;
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) return toast.error(error.message);
    setDraft({ title: "", priority: "medium", assigned_to: "" });
    setAddingCol(null);
    load();
  };

  const deleteTask = async (id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const updateAssignee = async (id: string, value: string) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, assigned_to: value || null } : t)));
    await supabase
      .from("tasks")
      .update({ assigned_to: value || null })
      .eq("id", id);
  };

  if (!open) return null;

  const label = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-7xl bg-card border border-border rounded-3xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 px-6 py-5 border-b border-border">
          <div>
            <div className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">
              Quadro do dia
            </div>
            <h2 className="font-display font-bold text-2xl capitalize mt-0.5">{label}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Arraste cartões entre colunas para organizar as tarefas do time.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 grid place-items-center rounded-xl border border-border hover:bg-muted"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-6">
          {loading ? (
            <div className="grid place-items-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLUMNS.map((col) => {
                const items = grouped[col.key];
                const isHover = hoverCol === col.key;
                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setHoverCol(col.key);
                    }}
                    onDragLeave={() => setHoverCol((h) => (h === col.key ? null : h))}
                    onDrop={() => onDrop(col.key)}
                    className={`rounded-2xl border bg-gradient-to-b ${col.accent} border-border transition ${
                      isHover ? "ring-2 ring-primary border-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-sm">{col.label}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-background/60 border border-border">
                          {items.length}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setAddingCol(col.key);
                          setDraft({ title: "", priority: "medium", assigned_to: "" });
                        }}
                        className="h-7 w-7 grid place-items-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20"
                        aria-label="Adicionar tarefa"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="px-3 pb-3 space-y-2 min-h-[120px]">
                      {addingCol === col.key && (
                        <div className="rounded-xl border border-primary/40 bg-background p-3 space-y-2">
                          <input
                            autoFocus
                            value={draft.title}
                            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") createTask(col.key);
                              if (e.key === "Escape") setAddingCol(null);
                            }}
                            placeholder="Título da tarefa…"
                            className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm"
                          />
                          <div className="flex gap-2">
                            <select
                              value={draft.priority}
                              onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                              className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-xs"
                            >
                              <option value="low">Baixa</option>
                              <option value="medium">Média</option>
                              <option value="high">Alta</option>
                            </select>
                            <select
                              value={draft.assigned_to}
                              onChange={(e) =>
                                setDraft({ ...draft, assigned_to: e.target.value })
                              }
                              className="flex-1 h-8 px-2 rounded-lg border border-border bg-background text-xs"
                            >
                              <option value="">Sem responsável</option>
                              {members.map((m) => (
                                <option key={m.user_id} value={m.user_id}>
                                  {m.name || m.email || "—"}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setAddingCol(null)}
                              className="h-8 px-3 text-xs rounded-lg border border-border"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => createTask(col.key)}
                              className="h-8 px-3 text-xs font-bold rounded-lg bg-primary text-primary-foreground"
                            >
                              Adicionar
                            </button>
                          </div>
                        </div>
                      )}

                      {items.length === 0 && addingCol !== col.key && (
                        <div className="text-center text-xs text-muted-foreground py-8 border border-dashed border-border rounded-xl">
                          Solte um cartão aqui
                        </div>
                      )}

                      {items.map((t) => {
                        const assignee = t.assigned_to ? memberById.get(t.assigned_to) : null;
                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={() => setDragId(t.id)}
                            onDragEnd={() => setDragId(null)}
                            className={`group rounded-xl border border-border bg-background p-3 shadow-sm hover:shadow-md transition cursor-grab active:cursor-grabbing ${
                              dragId === t.id ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm leading-snug">
                                  {t.title}
                                </div>
                                {t.description && (
                                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {t.description}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => deleteTask(t.id)}
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded-md hover:bg-destructive/10 text-destructive transition"
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between mt-3 gap-2">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium
                                }`}
                              >
                                <Flag className="h-3 w-3" />
                                {t.priority === "high"
                                  ? "Alta"
                                  : t.priority === "low"
                                    ? "Baixa"
                                    : "Média"}
                              </span>

                              <div className="flex items-center gap-1">
                                {assignee ? (
                                  <div
                                    className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold bg-primary/15 text-primary border border-primary/30"
                                    title={assignee.name || assignee.email || ""}
                                  >
                                    {initials(assignee.name, assignee.email)}
                                  </div>
                                ) : (
                                  <div className="h-6 w-6 rounded-full grid place-items-center border border-dashed border-border text-muted-foreground">
                                    <UserIcon className="h-3 w-3" />
                                  </div>
                                )}
                                <select
                                  value={t.assigned_to ?? ""}
                                  onChange={(e) => updateAssignee(t.id, e.target.value)}
                                  className="text-[10px] bg-transparent border border-border rounded-md px-1 py-0.5 max-w-[110px]"
                                  title="Responsável"
                                >
                                  <option value="">—</option>
                                  {members.map((m) => (
                                    <option key={m.user_id} value={m.user_id}>
                                      {m.name || m.email || "—"}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
