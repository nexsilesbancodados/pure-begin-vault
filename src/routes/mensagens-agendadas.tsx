import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Trash2, Send, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/mensagens-agendadas")({
  component: ScheduledMessagesPage,
});

type Scheduled = {
  id: string;
  to_phone: string;
  body: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
  error: string | null;
  instance_name: string | null;
  created_at: string;
};

const statusBadge: Record<string, { class: string; label: string }> = {
  pending: { class: "bg-warning/15 text-warning", label: "Agendada" },
  sent: { class: "bg-success/15 text-success", label: "Enviada" },
  failed: { class: "bg-destructive/15 text-destructive", label: "Falhou" },
  cancelled: { class: "bg-muted text-muted-foreground", label: "Cancelada" },
};

function ScheduledMessagesPage() {
  const { orgId, userId } = useOrg();
  const [list, setList] = useState<Scheduled[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error: err } = await (supabase as any)
      .from("scheduled_messages")
      .select("*")
      .eq("organization_id", orgId)
      .order("scheduled_at", { ascending: false })
      .limit(200);
    if (err) {
      setError("Tabela scheduled_messages não encontrada. Aplique a migration 20260512020000_features_extras.sql.");
    } else {
      setList((data as Scheduled[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  const schedule = async () => {
    if (!orgId || !userId) return;
    if (!phone.trim() || !body.trim() || !scheduledAt) {
      toast.error("Preencha telefone, mensagem e data");
      return;
    }
    setSaving(true);
    const { error: err } = await (supabase as any).from("scheduled_messages").insert({
      organization_id: orgId,
      user_id: userId,
      to_phone: phone.replace(/\D/g, ""),
      body,
      scheduled_at: new Date(scheduledAt).toISOString(),
    });
    setSaving(false);
    if (err) { toast.error("Erro: " + err.message); return; }
    toast.success("Mensagem agendada");
    setPhone(""); setBody(""); setScheduledAt("");
    load();
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancelar esta mensagem agendada?")) return;
    const { error: err } = await (supabase as any)
      .from("scheduled_messages")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (err) { toast.error("Erro: " + err.message); return; }
    toast.success("Cancelada");
    load();
  };

  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Mensagens Agendadas" subtitle="WhatsApp para envio futuro" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {error ? (
            <Card className="p-5 border-warning/30 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-black mb-1">Agendamento não habilitado</p>
                  <p className="text-muted-foreground">{error}</p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Nova mensagem
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4">
                    <Label htmlFor="phone">Telefone (com DDD)</Label>
                    <Input
                      id="phone"
                      placeholder="11999999999"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Label htmlFor="schedat">Data e hora</Label>
                    <Input
                      id="schedat"
                      type="datetime-local"
                      min={minDateTime}
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-12">
                    <Label htmlFor="body">Mensagem</Label>
                    <textarea
                      id="body"
                      placeholder="Olá! Lembrando que sua OS está pronta para retirar..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full h-24 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    />
                  </div>
                  <div className="md:col-span-12 flex justify-end">
                    <Button onClick={schedule} disabled={saving}>
                      <Calendar className="h-4 w-4 mr-2" />
                      {saving ? "Agendando..." : "Agendar"}
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">
                  As mensagens são enviadas pela Edge Function dispatch-scheduled-messages, que roda a cada minuto.
                </p>
              </Card>

              <Card className="p-5">
                <h3 className="font-black text-sm uppercase tracking-widest mb-3">
                  Fila ({list.length})
                </h3>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : list.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhuma mensagem agendada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.map((m) => {
                      const sb = statusBadge[m.status] ?? statusBadge.pending;
                      return (
                        <div
                          key={m.id}
                          className="flex items-start gap-3 p-3 rounded-xl border border-border"
                        >
                          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                            {m.status === "sent" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : m.status === "failed" ? (
                              <AlertCircle className="h-4 w-4" />
                            ) : (
                              <Clock className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={sb.class}>{sb.label}</Badge>
                              <span className="text-xs font-bold">{m.to_phone}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(m.scheduled_at).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <p className="text-sm mt-1 line-clamp-2">{m.body}</p>
                            {m.error && (
                              <p className="text-[10px] text-destructive mt-1">⚠ {m.error}</p>
                            )}
                          </div>
                          {m.status === "pending" && (
                            <button
                              onClick={() => cancel(m.id)}
                              className="text-muted-foreground hover:text-destructive transition shrink-0"
                              title="Cancelar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
