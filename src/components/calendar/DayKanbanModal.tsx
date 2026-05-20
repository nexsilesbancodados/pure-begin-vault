import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { useServerFn } from "@tanstack/react-start";
import { listOrgMembers, type OrgMember } from "@/lib/org-members.functions";
import {
  X,
  Plus,
  Loader2,
  Trash2,
  Flag,
  User as UserIcon,
  MoreHorizontal,
  Maximize2,
  Minimize2,
  Check,
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

type KList = { id: string; name: string; color: string };

// Trello-like list color presets
const LIST_COLORS = [
  { name: "Cinza", value: "slate", header: "bg-slate-100", bg: "bg-slate-50", ring: "ring-slate-300", dot: "bg-slate-400" },
  { name: "Azul", value: "blue", header: "bg-sky-100", bg: "bg-sky-50", ring: "ring-sky-300", dot: "bg-sky-500" },
  { name: "Verde", value: "green", header: "bg-emerald-100", bg: "bg-emerald-50", ring: "ring-emerald-300", dot: "bg-emerald-500" },
  { name: "Amarelo", value: "yellow", header: "bg-amber-100", bg: "bg-amber-50", ring: "ring-amber-300", dot: "bg-amber-500" },
  { name: "Laranja", value: "orange", header: "bg-orange-100", bg: "bg-orange-50", ring: "ring-orange-300", dot: "bg-orange-500" },
  { name: "Vermelho", value: "red", header: "bg-rose-100", bg: "bg-rose-50", ring: "ring-rose-300", dot: "bg-rose-500" },
  { name: "Roxo", value: "purple", header: "bg-violet-100", bg: "bg-violet-50", ring: "ring-violet-300", dot: "bg-violet-500" },
  { name: "Rosa", value: "pink", header: "bg-pink-100", bg: "bg-pink-50", ring: "ring-pink-300", dot: "bg-pink-500" },
];

const colorOf = (v: string) => LIST_COLORS.find((c) => c.value === v) ?? LIST_COLORS[0];

const DEFAULT_LISTS: KList[] = [
  { id: "todo", name: "A fazer", color: "slate" },
  { id: "doing", name: "Em andamento", color: "blue" },
  { id: "done", name: "Concluído", color: "green" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-rose-100 text-rose-700 border-rose-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

function initials(name: string | null | undefined, email: string | null | undefined) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
  const [draft, setDraft] = useState("");
  const [lists, setLists] = useState<KList[]>(DEFAULT_LISTS);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [listMenu, setListMenu] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const storageKey = useMemo(
    () => `kanban:lists:${orgId || user?.id || "anon"}:${ymd(date)}`,
    [orgId, user?.id, date],
  );

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

  // Load lists from localStorage
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLists(parsed);
          return;
        }
      }
    } catch { /* ignore */ }
    setLists(DEFAULT_LISTS);
  }, [open, storageKey]);

  // Persist lists
  useEffect(() => {
    if (!open) return;
    try { localStorage.setItem(storageKey, JSON.stringify(lists)); } catch { /* ignore */ }
  }, [lists, storageKey, open]);

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

  // Map task status -> list id. Status stores the list id directly; legacy
  // tasks fall back to the first list.
  const grouped = useMemo(() => {
    const m: Record<string, KanbanTask[]> = {};
    for (const l of lists) m[l.id] = [];
    for (const t of tasks) {
      if (m[t.status]) m[t.status].push(t);
      else if (lists[0]) m[lists[0].id].push(t);
    }
    return m;
  }, [tasks, lists]);

  const memberById = useMemo(() => {
    const m = new Map<string, OrgMember>();
    members.forEach((mm) => m.set(mm.user_id, mm));
    return m;
  }, [members]);

  const onDrop = async (listId: string) => {
    setHoverCol(null);
    if (!dragId) return;
    const t = tasks.find((x) => x.id === dragId);
    setDragId(null);
    if (!t || t.status === listId) return;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: listId } : x)));
    const { error } = await supabase.from("tasks").update({ status: listId }).eq("id", t.id);
    if (error) {
      toast.error("Falha ao mover");
      load();
    }
  };

  const createTask = async (listId: string) => {
    if (!draft.trim() || !user?.id) return;
    const due = new Date(date);
    due.setHours(9, 0, 0, 0);
    const payload: Record<string, unknown> = {
      user_id: user.id,
      organization_id: orgId,
      title: draft.trim(),
      priority: "medium",
      status: listId,
      due_date: due.toISOString(),
    };
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) return toast.error(error.message);
    setDraft("");
    load();
  };

  const deleteTask = async (id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const updateAssignee = async (id: string, value: string) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, assigned_to: value || null } : t)));
    await supabase.from("tasks").update({ assigned_to: value || null }).eq("id", id);
  };

  const togglePriority = async (id: string) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const next = current.priority === "high" ? "low" : current.priority === "low" ? "medium" : "high";
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, priority: next } : t)));
    await supabase.from("tasks").update({ priority: next }).eq("id", id);
  };

  const addList = () => {
    const name = newListName.trim();
    if (!name) return;
    const id = `list_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setLists((p) => [...p, { id, name, color: "slate" }]);
    setNewListName("");
    setAddingList(false);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: "smooth" });
    });
  };

  const renameList = (id: string, name: string) => {
    setLists((p) => p.map((l) => (l.id === id ? { ...l, name: name.trim() || l.name } : l)));
  };

  const setListColor = (id: string, color: string) => {
    setLists((p) => p.map((l) => (l.id === id ? { ...l, color } : l)));
  };

  const deleteList = async (id: string) => {
    const items = grouped[id] || [];
    if (items.length > 0) {
      const ok = window.confirm(`Esta lista tem ${items.length} cartão(ões). Excluir tudo?`);
      if (!ok) return;
      await supabase.from("tasks").delete().in("id", items.map((t) => t.id));
    }
    setLists((p) => p.filter((l) => l.id !== id));
    setListMenu(null);
    load();
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
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-stretch justify-center"
      onClick={onClose}
    >
      <div
        className={`bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-2xl flex flex-col w-full ${
          fullscreen ? "h-full" : "max-w-[1500px] m-3 sm:m-6 rounded-3xl border border-white/60"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Trello-like top bar */}
        <header className="flex items-center justify-between gap-4 px-5 py-3 bg-white/70 backdrop-blur border-b border-slate-200/70 rounded-t-3xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center text-white font-display font-bold shadow">
              {date.getDate()}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                Quadro do dia
              </div>
              <h2 className="font-display font-bold text-base sm:text-lg capitalize truncate text-slate-800">
                {label}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex -space-x-2">
              {members.slice(0, 5).map((m) => (
                <div
                  key={m.user_id}
                  className="h-8 w-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 grid place-items-center text-[11px] font-bold text-white border-2 border-white shadow-sm"
                  title={m.name || m.email || ""}
                >
                  {initials(m.name, m.email)}
                </div>
              ))}
              {members.length > 5 && (
                <div className="h-8 w-8 rounded-full bg-slate-200 grid place-items-center text-[10px] font-bold text-slate-600 border-2 border-white">
                  +{members.length - 5}
                </div>
              )}
            </div>
            <button
              onClick={() => setFullscreen((v) => !v)}
              className="h-9 w-9 grid place-items-center rounded-xl bg-white/80 border border-slate-200 hover:bg-white"
              aria-label="Expandir"
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="h-9 w-9 grid place-items-center rounded-xl bg-white/80 border border-slate-200 hover:bg-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Board */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden">
          {loading ? (
            <div className="grid place-items-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 sm:p-5 min-w-max h-full">
              {lists.map((list) => {
                const c = colorOf(list.color);
                const items = grouped[list.id] || [];
                const isHover = hoverCol === list.id;
                return (
                  <div
                    key={list.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setHoverCol(list.id);
                    }}
                    onDragLeave={() => setHoverCol((h) => (h === list.id ? null : h))}
                    onDrop={() => onDrop(list.id)}
                    className={`w-[300px] shrink-0 rounded-2xl ${c.bg} border border-slate-200/80 flex flex-col max-h-[calc(100vh-180px)] shadow-sm ${
                      isHover ? `ring-2 ${c.ring}` : ""
                    }`}
                  >
                    {/* List header */}
                    <div className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-t-2xl ${c.header}`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                        {editingList === list.id ? (
                          <input
                            autoFocus
                            defaultValue={list.name}
                            onBlur={(e) => {
                              renameList(list.id, e.target.value);
                              setEditingList(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setEditingList(null);
                            }}
                            className="flex-1 h-7 px-2 rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-800"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingList(list.id)}
                            className="font-bold text-sm text-slate-800 truncate text-left flex-1"
                            title="Renomear"
                          >
                            {list.name}
                          </button>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/70 text-slate-600">
                          {items.length}
                        </span>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setListMenu((m) => (m === list.id ? null : list.id))}
                          className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/60 text-slate-600"
                          aria-label="Opções"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {listMenu === list.id && (
                          <div
                            className="absolute right-0 top-9 z-20 w-56 bg-white rounded-xl border border-slate-200 shadow-xl p-2"
                            onMouseLeave={() => setListMenu(null)}
                          >
                            <div className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1">
                              Cor da lista
                            </div>
                            <div className="grid grid-cols-4 gap-1 p-1">
                              {LIST_COLORS.map((opt) => (
                                <button
                                  key={opt.value}
                                  onClick={() => {
                                    setListColor(list.id, opt.value);
                                    setListMenu(null);
                                  }}
                                  className={`h-8 rounded-md ${opt.header} border border-slate-200 hover:scale-105 transition relative`}
                                  title={opt.name}
                                >
                                  {list.color === opt.value && (
                                    <Check className="h-3 w-3 absolute inset-0 m-auto text-slate-700" />
                                  )}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => {
                                setEditingList(list.id);
                                setListMenu(null);
                              }}
                              className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-slate-100"
                            >
                              Renomear lista
                            </button>
                            <button
                              onClick={() => deleteList(list.id)}
                              className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-rose-50 text-rose-600 inline-flex items-center gap-2"
                            >
                              <Trash2 className="h-3 w-3" /> Excluir lista
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="px-2 py-2 space-y-2 overflow-y-auto flex-1">
                      {items.map((t) => {
                        const assignee = t.assigned_to ? memberById.get(t.assigned_to) : null;
                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={() => setDragId(t.id)}
                            onDragEnd={() => setDragId(null)}
                            className={`group rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm hover:shadow-md hover:border-sky-300 transition cursor-grab active:cursor-grabbing ${
                              dragId === t.id ? "opacity-50" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm leading-snug text-slate-800">
                                  {t.title}
                                </div>
                                {t.description && (
                                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {t.description}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => deleteTask(t.id)}
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded-md hover:bg-rose-50 text-rose-500 transition shrink-0"
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between mt-2 gap-2">
                              <button
                                onClick={() => togglePriority(t.id)}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  PRIORITY_COLORS[t.priority] ?? PRIORITY_COLORS.medium
                                }`}
                                title="Alterar prioridade"
                              >
                                <Flag className="h-3 w-3" />
                                {t.priority === "high" ? "Alta" : t.priority === "low" ? "Baixa" : "Média"}
                              </button>

                              <div className="flex items-center gap-1">
                                {assignee ? (
                                  <div
                                    className="h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold bg-gradient-to-br from-sky-400 to-indigo-500 text-white border-2 border-white shadow-sm"
                                    title={assignee.name || assignee.email || ""}
                                  >
                                    {initials(assignee.name, assignee.email)}
                                  </div>
                                ) : (
                                  <div className="h-6 w-6 rounded-full grid place-items-center border border-dashed border-slate-300 text-slate-400">
                                    <UserIcon className="h-3 w-3" />
                                  </div>
                                )}
                                <select
                                  value={t.assigned_to ?? ""}
                                  onChange={(e) => updateAssignee(t.id, e.target.value)}
                                  className="text-[10px] bg-white border border-slate-200 rounded-md px-1 py-0.5 max-w-[110px] text-slate-600"
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

                      {addingCol === list.id ? (
                        <div className="rounded-xl border border-sky-300 bg-white p-2 space-y-2 shadow-sm">
                          <textarea
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                createTask(list.id);
                              }
                              if (e.key === "Escape") {
                                setAddingCol(null);
                                setDraft("");
                              }
                            }}
                            placeholder="Insira um título para este cartão…"
                            rows={2}
                            className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => createTask(list.id)}
                              className="h-8 px-3 text-xs font-bold rounded-md bg-sky-600 text-white hover:bg-sky-700"
                            >
                              Adicionar cartão
                            </button>
                            <button
                              onClick={() => {
                                setAddingCol(null);
                                setDraft("");
                              }}
                              className="h-8 w-8 grid place-items-center rounded-md hover:bg-slate-100 text-slate-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingCol(list.id);
                            setDraft("");
                          }}
                          className="w-full text-left text-xs text-slate-600 hover:bg-white/70 rounded-md px-2 py-2 inline-flex items-center gap-1.5 transition"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar um cartão
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add list */}
              <div className="w-[300px] shrink-0">
                {addingList ? (
                  <div className="bg-white/90 rounded-2xl border border-slate-200 p-2 space-y-2 shadow-sm">
                    <input
                      autoFocus
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addList();
                        if (e.key === "Escape") {
                          setAddingList(false);
                          setNewListName("");
                        }
                      }}
                      placeholder="Insira o título da lista…"
                      className="w-full h-9 px-2 rounded-md border border-slate-200 bg-white text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={addList}
                        className="h-8 px-3 text-xs font-bold rounded-md bg-sky-600 text-white hover:bg-sky-700"
                      >
                        Adicionar lista
                      </button>
                      <button
                        onClick={() => {
                          setAddingList(false);
                          setNewListName("");
                        }}
                        className="h-8 w-8 grid place-items-center rounded-md hover:bg-slate-100 text-slate-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingList(true)}
                    className="w-full text-left text-sm font-semibold text-slate-700 bg-white/70 hover:bg-white rounded-2xl border border-dashed border-slate-300 px-3 py-3 inline-flex items-center gap-2 transition"
                  >
                    <Plus className="h-4 w-4" /> Adicionar outra lista
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
