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
  Search,
  CheckCheck,
  Copy,
  GripVertical,
  Calendar as CalendarIcon,
  AlignLeft,
  Clock,
  Filter,
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
  { name: "Cinza", value: "slate", header: "bg-slate-100", bg: "bg-slate-50/80", ring: "ring-slate-300", dot: "bg-slate-400", bar: "bg-slate-300" },
  { name: "Azul", value: "blue", header: "bg-sky-100", bg: "bg-sky-50/80", ring: "ring-sky-300", dot: "bg-sky-500", bar: "bg-sky-400" },
  { name: "Verde", value: "green", header: "bg-emerald-100", bg: "bg-emerald-50/80", ring: "ring-emerald-300", dot: "bg-emerald-500", bar: "bg-emerald-400" },
  { name: "Amarelo", value: "yellow", header: "bg-amber-100", bg: "bg-amber-50/80", ring: "ring-amber-300", dot: "bg-amber-500", bar: "bg-amber-400" },
  { name: "Laranja", value: "orange", header: "bg-orange-100", bg: "bg-orange-50/80", ring: "ring-orange-300", dot: "bg-orange-500", bar: "bg-orange-400" },
  { name: "Vermelho", value: "red", header: "bg-rose-100", bg: "bg-rose-50/80", ring: "ring-rose-300", dot: "bg-rose-500", bar: "bg-rose-400" },
  { name: "Roxo", value: "purple", header: "bg-violet-100", bg: "bg-violet-50/80", ring: "ring-violet-300", dot: "bg-violet-500", bar: "bg-violet-400" },
  { name: "Rosa", value: "pink", header: "bg-pink-100", bg: "bg-pink-50/80", ring: "ring-pink-300", dot: "bg-pink-500", bar: "bg-pink-400" },
];

const colorOf = (v: string) => LIST_COLORS.find((c) => c.value === v) ?? LIST_COLORS[0];

const DEFAULT_LISTS: KList[] = [
  { id: "todo", name: "A fazer", color: "slate" },
  { id: "doing", name: "Em andamento", color: "blue" },
  { id: "done", name: "Concluído", color: "green" },
];

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  high: { label: "Alta", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  medium: { label: "Média", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "Baixa", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

function isDoneList(name: string) {
  const n = (name || "").toLowerCase();
  return n.includes("concluí") || n.includes("conclui") || n === "done" || n.includes("feito");
}

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

function timeOf(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
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
  const [dragListId, setDragListId] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [lists, setLists] = useState<KList[]>(DEFAULT_LISTS);
  const [editingList, setEditingList] = useState<string | null>(null);
  const [listMenu, setListMenu] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [query, setQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState<string>("");
  const [openCard, setOpenCard] = useState<KanbanTask | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const storageKey = useMemo(
    () => `kanban:lists:${orgId || user?.id || "anon"}:${ymd(date)}`,
    [orgId, user?.id, date],
  );
  const scrollKey = useMemo(
    () => `kanban:scroll:${orgId || user?.id || "anon"}:${ymd(date)}`,
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

  useEffect(() => {
    if (!open) return;
    try { localStorage.setItem(storageKey, JSON.stringify(lists)); } catch { /* ignore */ }
  }, [lists, storageKey, open]);

  // Persist horizontal scroll position per day
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    try {
      const v = sessionStorage.getItem(scrollKey);
      if (v) el.scrollLeft = parseInt(v, 10) || 0;
    } catch { /* ignore */ }
    const onScroll = () => {
      try { sessionStorage.setItem(scrollKey, String(el.scrollLeft)); } catch { /* ignore */ }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open, scrollKey, loading]);

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

  // Keyboard shortcuts: "/" focuses search, "n" adds list, Esc closes drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField = target && /input|textarea|select/i.test(target.tagName);
      if (e.key === "Escape" && openCard) {
        setOpenCard(null);
        return;
      }
      if (inField) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setAddingList(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openCard]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (memberFilter && t.assigned_to !== memberFilter) return false;
      if (q) {
        const hay = `${t.title} ${t.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, query, memberFilter]);

  const grouped = useMemo(() => {
    const m: Record<string, KanbanTask[]> = {};
    for (const l of lists) m[l.id] = [];
    for (const t of filteredTasks) {
      if (m[t.status]) m[t.status].push(t);
      else if (lists[0]) m[lists[0].id].push(t);
    }
    return m;
  }, [filteredTasks, lists]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const doneListIds = new Set(lists.filter((l) => isDoneList(l.name)).map((l) => l.id));
    const done = tasks.filter((t) => doneListIds.has(t.status)).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, pct };
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

  // Create one or more cards (split by newline) for a list
  const createCards = async (listId: string, raw: string) => {
    const lines = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0 || !user?.id) return;
    const due = new Date(date);
    due.setHours(9, 0, 0, 0);
    const payloads = lines.map((title) => ({
      user_id: user.id,
      organization_id: orgId,
      title,
      priority: "medium",
      status: listId,
      due_date: due.toISOString(),
    }));
    const { error } = await supabase.from("tasks").insert(payloads);
    if (error) return toast.error(error.message);
    if (lines.length > 1) toast.success(`${lines.length} cartões adicionados`);
    setDraft("");
    load();
  };

  const deleteTask = async (id: string) => {
    setTasks((p) => p.filter((t) => t.id !== id));
    if (openCard?.id === id) setOpenCard(null);
    await supabase.from("tasks").delete().eq("id", id);
  };

  const updateTask = async (id: string, patch: Partial<KanbanTask>) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    if (openCard?.id === id) setOpenCard((c) => (c ? { ...c, ...patch } : c));
    await supabase.from("tasks").update(patch).eq("id", id);
  };

  const togglePriority = (id: string) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const next = current.priority === "high" ? "low" : current.priority === "low" ? "medium" : "high";
    updateTask(id, { priority: next });
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

  const clearListCards = async (id: string) => {
    const items = grouped[id] || [];
    if (items.length === 0) return;
    if (!window.confirm(`Remover ${items.length} cartão(ões) desta lista?`)) return;
    await supabase.from("tasks").delete().in("id", items.map((t) => t.id));
    setListMenu(null);
    load();
  };

  const clearCompleted = async () => {
    const doneIds = lists.filter((l) => isDoneList(l.name)).map((l) => l.id);
    const ids = tasks.filter((t) => doneIds.includes(t.status)).map((t) => t.id);
    if (ids.length === 0) return toast.info("Nenhum cartão concluído");
    if (!window.confirm(`Limpar ${ids.length} cartão(ões) concluído(s)?`)) return;
    await supabase.from("tasks").delete().in("id", ids);
    load();
    toast.success("Concluídos removidos");
  };

  // Drag-reorder lists
  const onListDragStart = (id: string) => setDragListId(id);
  const onListDragOver = (e: React.DragEvent, overId: string) => {
    if (!dragListId || dragListId === overId) return;
    e.preventDefault();
  };
  const onListDrop = (overId: string) => {
    if (!dragListId || dragListId === overId) return setDragListId(null);
    setLists((prev) => {
      const from = prev.findIndex((l) => l.id === dragListId);
      const to = prev.findIndex((l) => l.id === overId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragListId(null);
  };

  // Copy yesterday's board if today is empty
  const copyFromYesterday = async () => {
    if (!user?.id) return;
    const y = new Date(date);
    y.setDate(y.getDate() - 1);
    const ys = new Date(y); ys.setHours(0, 0, 0, 0);
    const ye = new Date(y); ye.setHours(23, 59, 59, 999);
    const base = supabase
      .from("tasks")
      .select("*")
      .gte("due_date", ys.toISOString())
      .lte("due_date", ye.toISOString());
    const { data } = await (orgId
      ? base.eq("organization_id", orgId)
      : base.eq("user_id", user.id));
    const src = (data as KanbanTask[]) || [];
    if (src.length === 0) return toast.info("Nenhum cartão no dia anterior");
    const due = new Date(date);
    due.setHours(9, 0, 0, 0);
    const payloads = src.map((t) => ({
      user_id: user.id,
      organization_id: orgId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      due_date: due.toISOString(),
      assigned_to: t.assigned_to,
    }));
    const { error } = await supabase.from("tasks").insert(payloads);
    if (error) return toast.error(error.message);
    toast.success(`${src.length} cartões copiados`);
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
        className={`bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-2xl flex flex-col w-full overflow-hidden ${
          fullscreen ? "h-full" : "max-w-[1500px] m-3 sm:m-6 rounded-3xl border border-white/60"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4 px-4 sm:px-5 py-2.5 bg-white/80 backdrop-blur border-b border-slate-200/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center text-white font-display font-bold shadow-md leading-none">
              <div className="text-[9px] font-medium opacity-80 -mb-0.5">
                {date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}
              </div>
              <div className="text-base">{date.getDate()}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                Quadro do dia · pressione <kbd className="px-1 rounded bg-slate-100 border border-slate-200 text-[9px]">/</kbd> para buscar
              </div>
              <h2 className="font-display font-bold text-base sm:text-lg capitalize truncate text-slate-800">
                {label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="hidden md:flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-white border border-slate-200 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 transition w-56">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cartões…"
                className="flex-1 bg-transparent outline-none text-xs"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Member filter */}
            {members.length > 0 && (
              <div className="hidden lg:flex items-center gap-1 h-9 px-2 rounded-lg bg-white border border-slate-200">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                  className="bg-transparent text-xs outline-none pr-1"
                  title="Filtrar por responsável"
                >
                  <option value="">Todos do time</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={clearCompleted}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
              title="Limpar cartões em listas de Concluído"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Limpar concluídos
            </button>

            {/* Avatars */}
            {members.length > 0 && (
              <div className="hidden sm:flex -space-x-2 ml-1">
                {members.slice(0, 4).map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => setMemberFilter((v) => (v === m.user_id ? "" : m.user_id))}
                    className={`h-8 w-8 rounded-full grid place-items-center text-[11px] font-bold text-white border-2 border-white shadow-sm transition ${
                      memberFilter === m.user_id
                        ? "bg-gradient-to-br from-sky-600 to-indigo-700 ring-2 ring-sky-400"
                        : "bg-gradient-to-br from-sky-400 to-indigo-500"
                    }`}
                    title={m.name || m.email || ""}
                  >
                    {initials(m.name, m.email)}
                  </button>
                ))}
                {members.length > 4 && (
                  <div className="h-8 w-8 rounded-full bg-slate-200 grid place-items-center text-[10px] font-bold text-slate-600 border-2 border-white">
                    +{members.length - 4}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setFullscreen((v) => !v)}
              className="h-9 w-9 grid place-items-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50"
              aria-label="Expandir"
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={onClose}
              className="h-9 w-9 grid place-items-center rounded-lg bg-white border border-slate-200 hover:bg-slate-50"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Progress strip */}
        <div className="px-5 py-2 bg-white/50 border-b border-slate-200/60 flex items-center gap-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100">
              {stats.total} cartões
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
              <CheckCheck className="h-3 w-3" /> {stats.done} concluídos
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-100 text-sky-700">
              {lists.length} listas
            </span>
          </div>
          <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          <div className="text-[11px] font-bold text-slate-700 tabular-nums w-9 text-right">
            {stats.pct}%
          </div>
        </div>

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
                const isDragging = dragListId === list.id;
                return (
                  <div
                    key={list.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragListId) onListDragOver(e, list.id);
                      else setHoverCol(list.id);
                    }}
                    onDragLeave={() => setHoverCol((h) => (h === list.id ? null : h))}
                    onDrop={() => {
                      if (dragListId) onListDrop(list.id);
                      else onDrop(list.id);
                    }}
                    className={`w-[290px] shrink-0 rounded-2xl ${c.bg} backdrop-blur border border-slate-200/80 flex flex-col max-h-[calc(100vh-220px)] shadow-sm transition ${
                      isHover ? `ring-2 ${c.ring}` : ""
                    } ${isDragging ? "opacity-50 scale-95" : ""}`}
                  >
                    {/* List header */}
                    <div className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-t-2xl ${c.header}`}>
                      <div
                        draggable
                        onDragStart={() => onListDragStart(list.id)}
                        onDragEnd={() => setDragListId(null)}
                        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-700"
                        title="Arraste para reordenar a lista"
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
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
                            title="Clique para renomear"
                          >
                            {list.name}
                          </button>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/80 text-slate-600">
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
                              onClick={() => clearListCards(list.id)}
                              className="w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-slate-100"
                            >
                              Limpar cartões
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
                    <div className="px-2 py-2 space-y-2 overflow-y-auto flex-1 min-h-[60px]">
                      {items.length === 0 && addingCol !== list.id && (
                        <div className="text-center text-[11px] text-slate-400 py-4 border border-dashed border-slate-200 rounded-xl">
                          Solte um cartão aqui
                        </div>
                      )}

                      {items.map((t) => {
                        const assignee = t.assigned_to ? memberById.get(t.assigned_to) : null;
                        const prio = PRIORITY_META[t.priority] ?? PRIORITY_META.medium;
                        const hasDesc = !!(t.description && t.description.trim());
                        return (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={() => setDragId(t.id)}
                            onDragEnd={() => setDragId(null)}
                            onClick={() => setOpenCard(t)}
                            className={`group rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm hover:shadow-md hover:border-sky-300 transition cursor-pointer ${
                              dragId === t.id ? "opacity-50 rotate-1" : ""
                            }`}
                          >
                            {/* Colored cover */}
                            <div className={`h-1 -m-2.5 mb-2 rounded-t-xl ${c.bar}`} />

                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm leading-snug text-slate-800">
                                  {t.title}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTask(t.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded-md hover:bg-rose-50 text-rose-500 transition shrink-0"
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                              <div className="flex items-center gap-1 flex-wrap">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePriority(t.id);
                                  }}
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${prio.cls}`}
                                  title="Alterar prioridade"
                                >
                                  <Flag className="h-3 w-3" />
                                  {prio.label}
                                </button>
                                {hasDesc && (
                                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-md text-slate-500 bg-slate-100" title="Tem descrição">
                                    <AlignLeft className="h-3 w-3" />
                                  </span>
                                )}
                                {t.due_date && timeOf(t.due_date) !== "00:00" && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                    <Clock className="h-3 w-3" /> {timeOf(t.due_date)}
                                  </span>
                                )}
                              </div>

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
                                createCards(list.id, draft);
                              }
                              if (e.key === "Escape") {
                                setAddingCol(null);
                                setDraft("");
                              }
                            }}
                            placeholder="Título do cartão… (Enter para salvar, várias linhas = vários cartões)"
                            rows={2}
                            className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm resize-none"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => createCards(list.id, draft)}
                                className="h-8 px-3 text-xs font-bold rounded-md bg-sky-600 text-white hover:bg-sky-700"
                              >
                                Adicionar
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
                            <span className="text-[10px] text-slate-400">
                              {draft.split("\n").filter((s) => s.trim()).length || 0} cartões
                            </span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingCol(list.id);
                            setDraft("");
                          }}
                          className="w-full text-left text-xs font-medium text-slate-600 hover:bg-white rounded-md px-2 py-2 inline-flex items-center gap-1.5 transition"
                        >
                          <Plus className="h-3.5 w-3.5" /> Adicionar um cartão
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add list / Templates */}
              <div className="w-[290px] shrink-0 space-y-2">
                {addingList ? (
                  <div className="bg-white/95 rounded-2xl border border-slate-200 p-2 space-y-2 shadow-sm">
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
                    <kbd className="ml-auto text-[9px] px-1 rounded bg-slate-100 border border-slate-200">N</kbd>
                  </button>
                )}

                {tasks.length === 0 && (
                  <button
                    onClick={copyFromYesterday}
                    className="w-full text-left text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-2xl border border-sky-200 px-3 py-2.5 inline-flex items-center gap-2 transition"
                    title="Importar os cartões do dia anterior"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar quadro do dia anterior
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Card detail drawer */}
        {openCard && (
          <CardDrawer
            task={openCard}
            members={members}
            lists={lists}
            onClose={() => setOpenCard(null)}
            onChange={(patch) => updateTask(openCard.id, patch)}
            onDelete={() => deleteTask(openCard.id)}
          />
        )}
      </div>
    </div>
  );
}

function CardDrawer({
  task,
  members,
  lists,
  onClose,
  onChange,
  onDelete,
}: {
  task: KanbanTask;
  members: OrgMember[];
  lists: KList[];
  onClose: () => void;
  onChange: (patch: Partial<KanbanTask>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeValue = task.due_date
    ? new Date(task.due_date).toTimeString().slice(0, 5)
    : "";

  const updateTime = (v: string) => {
    if (!task.due_date) return;
    const d = new Date(task.due_date);
    const [hh, mm] = v.split(":").map((x) => parseInt(x, 10));
    d.setHours(hh || 0, mm || 0, 0, 0);
    onChange({ due_date: d.toISOString() });
  };

  return (
    <div
      className="absolute inset-0 z-30 bg-slate-900/30 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <aside
        className="w-full max-w-md bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
              Cartão
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Title */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== task.title && onChange({ title: title.trim() })}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none text-sm font-semibold text-slate-800"
            />
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500">Lista</label>
              <select
                value={task.status}
                onChange={(e) => onChange({ status: e.target.value })}
                className="w-full mt-1 px-2 py-2 rounded-lg border border-slate-200 text-sm"
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500">Prioridade</label>
              <select
                value={task.priority}
                onChange={(e) => onChange({ priority: e.target.value })}
                className="w-full mt-1 px-2 py-2 rounded-lg border border-slate-200 text-sm"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500">Responsável</label>
              <select
                value={task.assigned_to ?? ""}
                onChange={(e) => onChange({ assigned_to: e.target.value || null })}
                className="w-full mt-1 px-2 py-2 rounded-lg border border-slate-200 text-sm"
              >
                <option value="">Sem responsável</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500">Horário</label>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => updateTime(e.target.value)}
                className="w-full mt-1 px-2 py-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
          </div>

          {/* Date display */}
          {task.due_date && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <CalendarIcon className="h-3.5 w-3.5" />
              {new Date(task.due_date).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (task.description ?? "") && onChange({ description })}
              rows={6}
              placeholder="Adicione mais detalhes sobre esta tarefa…"
              className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none text-sm resize-y"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              if (window.confirm("Excluir este cartão?")) onDelete();
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-bold"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir cartão
          </button>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
          >
            Fechar
          </button>
        </div>
      </aside>
    </div>
  );
}
