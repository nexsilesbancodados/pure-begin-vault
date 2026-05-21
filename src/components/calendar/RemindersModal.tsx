import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { Bell, Plus, Trash2, Check, CheckCircle2, Pencil, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { notify } from "@/lib/notify";

type Reminder = {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  amount: number | null;
  day_of_month: number;
  notes: string | null;
  active: boolean;
};

type Completion = {
  id: string;
  reminder_id: string;
  year: number;
  month: number;
  completed_by_name: string | null;
  completed_at: string;
};

const fmtBRL = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RemindersModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [items, setItems] = useState<Reminder[]>([]);
  const [comps, setComps] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(false);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const [form, setForm] = useState({
    id: "" as string | "",
    title: "",
    amount: "",
    day_of_month: String(today.getDate()),
    notes: "",
  });
  const editing = !!form.id;

  const reset = () =>
    setForm({ id: "", title: "", amount: "", day_of_month: String(today.getDate()), notes: "" });

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const [{ data: rs }, { data: cs }] = await Promise.all([
      supabase
        .from("recurring_reminders" as never)
        .select("*")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("day_of_month", { ascending: true }),
      supabase
        .from("reminder_completions" as never)
        .select("*")
        .eq("organization_id", orgId)
        .eq("year", year)
        .eq("month", month),
    ]);
    setItems(((rs as unknown) as Reminder[]) || []);
    setComps(((cs as unknown) as Completion[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    /* eslint-disable-next-line */
  }, [open, orgId]);

  const compByReminder = useMemo(() => {
    const m = new Map<string, Completion>();
    comps.forEach((c) => m.set(c.reminder_id, c));
    return m;
  }, [comps]);

  const save = async () => {
    if (!user?.id || !orgId) return;
    const day = Math.max(1, Math.min(31, Number(form.day_of_month) || 0));
    if (!form.title.trim() || !day) return toast.error("Preencha título e dia");
    const payload = {
      organization_id: orgId,
      user_id: user.id,
      title: form.title.trim(),
      amount: form.amount ? Number(form.amount) : null,
      day_of_month: day,
      notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase
        .from("recurring_reminders" as never)
        .update(payload as never)
        .eq("id", form.id);
      if (error) return toast.error(error.message);
      toast.success("Lembrete atualizado");
    } else {
      const { error } = await supabase.from("recurring_reminders" as never).insert(payload as never);
      if (error) return toast.error(error.message);
      toast.success("Lembrete criado");
    }
    reset();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este lembrete?")) return;
    const { error } = await supabase
      .from("recurring_reminders" as never)
      .update({ active: false } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    load();
  };

  const toggleComplete = async (r: Reminder) => {
    const existing = compByReminder.get(r.id);
    if (existing) {
      const { error } = await supabase
        .from("reminder_completions" as never)
        .delete()
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
      toast.success("Conclusão desfeita");
    } else {
      if (!user?.id || !orgId) return;
      const name =
        (user.user_metadata as { full_name?: string })?.full_name || user.email || "Usuário";
      const { error } = await supabase.from("reminder_completions" as never).insert({
        reminder_id: r.id,
        organization_id: orgId,
        year,
        month,
        completed_by: user.id,
        completed_by_name: name,
      } as never);
      if (error) return toast.error(error.message);
      toast.success(`Concluído: ${r.title}`);
    }
    load();
  };

  const startEdit = (r: Reminder) => {
    setForm({
      id: r.id,
      title: r.title,
      amount: r.amount != null ? String(r.amount) : "",
      day_of_month: String(r.day_of_month),
      notes: r.notes || "",
    });
  };

  if (!open) return null;

  const pendingToday = items.filter(
    (r) => r.day_of_month === today.getDate() && !compByReminder.has(r.id),
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 grid place-items-center rounded-xl bg-primary/15 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">Lembretes recorrentes</h2>
              <p className="text-xs text-muted-foreground">
                Contas e tarefas mensais — receba notificação no dia certo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {pendingToday.length > 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <div className="font-bold text-warning mb-1">
                ⚠️ {pendingToday.length} lembrete(s) vencem hoje
              </div>
              <ul className="list-disc pl-5 text-xs text-foreground/80">
                {pendingToday.map((r) => (
                  <li key={r.id}>
                    {r.title} {r.amount ? `· ${fmtBRL(r.amount)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* form */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="text-[11px] uppercase font-bold text-muted-foreground">
              {editing ? "Editar lembrete" : "Novo lembrete"}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Aluguel da loja"
                className="md:col-span-6 h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
              <input
                type="number"
                value={form.day_of_month}
                onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
                placeholder="Dia"
                min={1}
                max={31}
                className="md:col-span-2 h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="R$ valor (opcional)"
                className="md:col-span-4 h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Observações (opcional)"
                className="md:col-span-12 px-3 py-2 rounded-lg border border-border bg-background text-sm min-h-[60px]"
              />
            </div>
            <div className="flex justify-end gap-2">
              {editing && (
                <button
                  onClick={reset}
                  className="h-9 px-3 rounded-lg border border-border text-xs font-bold"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={save}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90"
              >
                {editing ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {editing ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>

          {/* list */}
          <div>
            <div className="text-[11px] uppercase font-bold text-muted-foreground mb-2">
              Lembretes ativos · {today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </div>
            {loading ? (
              <div className="text-sm text-muted-foreground text-center py-6">Carregando…</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10 border border-dashed border-border rounded-xl">
                Nenhum lembrete cadastrado ainda
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((r) => {
                  const done = compByReminder.get(r.id);
                  const isToday = r.day_of_month === today.getDate();
                  return (
                    <div
                      key={r.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${
                        done
                          ? "border-success/40 bg-success/5"
                          : isToday
                            ? "border-warning/40 bg-warning/5"
                            : "border-border bg-card"
                      }`}
                    >
                      <button
                        onClick={() => toggleComplete(r)}
                        className={`h-9 w-9 grid place-items-center rounded-lg flex-shrink-0 ${
                          done
                            ? "bg-success text-success-foreground"
                            : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                        }`}
                        title={done ? "Desfazer" : "Marcar como concluído"}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-bold text-sm ${done ? "line-through text-muted-foreground" : ""}`}
                          >
                            {r.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            Dia {r.day_of_month}
                          </span>
                          {r.amount != null && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-foreground/10">
                              {fmtBRL(r.amount)}
                            </span>
                          )}
                          {done && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success">
                              Concluído por {done.completed_by_name || "—"}
                            </span>
                          )}
                        </div>
                        {r.notes && (
                          <div className="text-xs text-muted-foreground mt-0.5">{r.notes}</div>
                        )}
                      </div>
                      <button
                        onClick={() => startEdit(r)}
                        className="h-8 w-8 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(r.id)}
                        className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dispara notificações in-app para lembretes que vencem hoje e ainda não foram
 * concluídos. Executado uma vez por dia por usuário (controlado via localStorage).
 */
export async function checkRemindersDueToday(params: {
  userId: string;
  organizationId: string | null;
}) {
  if (!params.userId || !params.organizationId) return;
  const today = new Date();
  const key = `reminders-check:${params.organizationId}:${today.toISOString().slice(0, 10)}`;
  if (typeof window !== "undefined" && localStorage.getItem(key)) return;
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const { data: rs } = await supabase
    .from("recurring_reminders" as never)
    .select("id,title,amount,day_of_month")
    .eq("organization_id", params.organizationId)
    .eq("active", true)
    .eq("day_of_month", day);
  const reminders = ((rs as unknown) as { id: string; title: string; amount: number | null }[]) || [];
  if (reminders.length === 0) {
    if (typeof window !== "undefined") localStorage.setItem(key, "1");
    return;
  }
  const { data: done } = await supabase
    .from("reminder_completions" as never)
    .select("reminder_id")
    .eq("organization_id", params.organizationId)
    .eq("year", year)
    .eq("month", month);
  const doneSet = new Set(((done as unknown) as { reminder_id: string }[] || []).map((d) => d.reminder_id));
  const pending = reminders.filter((r) => !doneSet.has(r.id));
  for (const r of pending) {
    await notify({
      user_id: params.userId,
      organization_id: params.organizationId,
      type: "reminder_due",
      title: `Lembrete: ${r.title}`,
      body: r.amount
        ? `Vence hoje · ${r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "Vence hoje",
      link: "/calendario",
    });
  }
  if (typeof window !== "undefined") localStorage.setItem(key, "1");
}
