import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Check, CheckCheck, Flag, Clock, Lock, Loader2, X, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { listOrgMembers, type OrgMember } from "@/lib/org-members.functions";

type Template = {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  priority: string;
  time_label: string | null;
  position: number;
  is_active: boolean;
};

type Completion = {
  id: string;
  template_id: string;
  user_id: string;
  completed_at: string;
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  high: { label: "Alta", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  medium: { label: "Média", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "Baixa", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function DailyTasksColumn({
  date,
  orgId,
  ownerOnlyForUserId,
}: {
  date: Date;
  orgId: string | null;
  ownerOnlyForUserId?: string;
}) {
  const { user } = useAuth();
  const fetchMembers = useServerFn(listOrgMembers);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", time: "", priority: "medium" });
  const dateKey = ymd(date);

  useEffect(() => {
    if (!orgId) { setMembers([]); return; }
    fetchMembers({ data: { orgId } } as any).then((r: any) => setMembers(r?.members ?? [])).catch(() => setMembers([]));
  }, [orgId, fetchMembers]);

  const memberName = (uid: string | null | undefined) => {
    if (!uid) return "—";
    if (uid === user?.id) return "Você";
    const m = members.find((x) => x.user_id === uid);
    return m?.name || m?.email || "Membro";
  };

  const load = async () => {
    if (!orgId) {
      setTemplates([]);
      setCompletions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: tpl }, { data: comp }] = await Promise.all([
      supabase
        .from("daily_task_templates")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("daily_task_completions")
        .select("*")
        .eq("organization_id", orgId)
        .eq("date", dateKey),
    ]);
    setTemplates((tpl as Template[]) || []);
    setCompletions((comp as Completion[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, dateKey]);

  const completedSet = useMemo(
    () => new Set(completions.map((c) => c.template_id)),
    [completions],
  );

  // Owner = whoever the gestor is for this org (passed in) OR the template creator.
  // For the manage UI we require user to match ownerOnlyForUserId; if not provided,
  // any signed-in user that CREATED a template can edit their own.
  const canManageAll = !!user?.id && !!ownerOnlyForUserId && user.id === ownerOnlyForUserId;
  const isOwnerOf = (t: Template) => !!user?.id && t.created_by === user.id;
  const canManage = (t: Template) => canManageAll || isOwnerOf(t);

  const addTemplate = async () => {
    const title = draft.title.trim();
    if (!title || !user?.id || !orgId) return;
    const { error } = await supabase.from("daily_task_templates").insert({
      organization_id: orgId,
      created_by: user.id,
      title,
      priority: draft.priority,
      time_label: draft.time || null,
      position: templates.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Tarefa diária adicionada");
    setDraft({ title: "", time: "", priority: "medium" });
    setAdding(false);
    load();
  };

  const removeTemplate = async (id: string) => {
    if (!confirm("Remover esta tarefa diária? Ela deixará de aparecer em todos os dias.")) return;
    const { error } = await supabase
      .from("daily_task_templates")
      .update({ is_active: false })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Tarefa removida");
    load();
  };

  const toggleCompletion = async (t: Template) => {
    if (!user?.id || !orgId) return;
    const existing = completions.find((c) => c.template_id === t.id);
    if (existing) {
      // optimistic
      setCompletions((p) => p.filter((c) => c.id !== existing.id));
      const { error } = await supabase
        .from("daily_task_completions")
        .delete()
        .eq("id", existing.id);
      if (error) {
        toast.error("Falha ao desfazer");
        load();
      }
      return;
    }
    const optimistic: Completion = {
      id: `tmp_${Date.now()}`,
      template_id: t.id,
      user_id: user.id,
      completed_at: new Date().toISOString(),
    };
    setCompletions((p) => [...p, optimistic]);
    const { data, error } = await supabase
      .from("daily_task_completions")
      .insert({
        template_id: t.id,
        organization_id: orgId,
        user_id: user.id,
        date: dateKey,
      })
      .select()
      .single();
    if (error) {
      toast.error("Falha ao confirmar");
      load();
      return;
    }
    setCompletions((p) => p.map((c) => (c.id === optimistic.id ? (data as Completion) : c)));
    toast.success("Tarefa confirmada");
  };

  const doneCount = templates.filter((t) => completedSet.has(t.id)).length;

  return (
    <div className="w-[290px] shrink-0 rounded-2xl bg-violet-50/80 backdrop-blur border-2 border-violet-200 flex flex-col max-h-[calc(100vh-220px)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-t-2xl bg-violet-100">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Lock className="h-3.5 w-3.5 text-violet-600" />
          <span className="font-bold text-sm text-violet-900 truncate">Tarefas Diárias</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/80 text-violet-700">
            {doneCount}/{templates.length}
          </span>
        </div>
        {canManageAll && (
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-violet-200 text-violet-800"
            title="Você gerencia esta coluna"
          >
            GESTOR
          </span>
        )}
      </div>

      {/* Description */}
      <div className="px-3 py-2 text-[10px] text-violet-700/80 bg-violet-50 border-b border-violet-200">
        Tarefas que aparecem todos os dias. {canManageAll ? "Edite/adicione livremente." : "Somente o gestor edita — você confirma a execução do dia."}
      </div>

      {/* Cards */}
      <div className="px-2 py-2 space-y-2 overflow-y-auto flex-1 min-h-[80px]">
        {loading ? (
          <div className="grid place-items-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center text-[11px] text-violet-400 py-4 border border-dashed border-violet-200 rounded-xl">
            Nenhuma tarefa diária ainda
          </div>
        ) : (
          templates.map((t) => {
            const confirmed = completedSet.has(t.id);
            const prio = PRIORITY_META[t.priority] ?? PRIORITY_META.medium;
            return (
              <div
                key={t.id}
                className={`group rounded-xl border bg-white p-2.5 shadow-sm hover:shadow-md transition ${
                  confirmed
                    ? "border-emerald-300 bg-emerald-50/60"
                    : "border-violet-200 hover:border-violet-400"
                }`}
              >
                <div className="h-1 -m-2.5 mb-2 rounded-t-xl bg-violet-400" />
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm leading-snug ${confirmed ? "line-through text-slate-500" : "text-slate-800"}`}>
                      {t.title}
                    </div>
                  </div>
                  {canManage(t) && (
                    <button
                      onClick={() => removeTemplate(t.id)}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 grid place-items-center rounded-md hover:bg-rose-50 text-rose-500 transition shrink-0"
                      aria-label="Remover tarefa diária"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-wrap mt-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${prio.cls}`}>
                    <Flag className="h-3 w-3" /> {prio.label}
                  </span>
                  {t.time_label && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      <Clock className="h-3 w-3" /> {t.time_label}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => toggleCompletion(t)}
                  className={`mt-2 w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md text-[11px] font-bold transition ${
                    confirmed
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                  }`}
                >
                  {confirmed ? (
                    <>
                      <CheckCheck className="h-3.5 w-3.5" /> Concluída hoje
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Confirmar conclusão
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}

        {canManageAll && (
          adding ? (
            <div className="rounded-xl border border-violet-300 bg-white p-2 space-y-2 shadow-sm">
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTemplate();
                  if (e.key === "Escape") { setAdding(false); setDraft({ title: "", time: "", priority: "medium" }); }
                }}
                placeholder="Título da tarefa diária…"
                className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white text-sm"
              />
              <div className="flex items-center gap-2">
                <input
                  value={draft.time}
                  onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  placeholder="HH:MM"
                  className="w-20 h-8 px-2 rounded-md border border-slate-200 bg-white text-xs"
                />
                <select
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                  className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs flex-1"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={addTemplate}
                  className="h-8 px-3 text-xs font-bold rounded-md bg-violet-600 text-white hover:bg-violet-700"
                >
                  Adicionar
                </button>
                <button
                  onClick={() => { setAdding(false); setDraft({ title: "", time: "", priority: "medium" }); }}
                  className="h-8 w-8 grid place-items-center rounded-md hover:bg-slate-100 text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full text-left text-xs font-medium text-violet-700 hover:bg-white rounded-md px-2 py-2 inline-flex items-center gap-1.5 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar tarefa diária
            </button>
          )
        )}
      </div>
    </div>
  );
}
