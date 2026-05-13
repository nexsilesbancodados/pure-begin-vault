import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Users, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/broadcast")({
  component: BroadcastPage,
});

type Target = {
  id: string;
  name: string;
  phone: string;
  source: "customer" | "lead";
};

function BroadcastPage() {
  const { orgId } = useOrg();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"all_customers" | "all_leads" | "active_customers">(
    "active_customers",
  );
  const [targets, setTargets] = useState<Target[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; failed: number; total: number } | null>(
    null,
  );

  useEffect(() => {
    if (!orgId) return;
    setLoadingTargets(true);
    (async () => {
      let list: Target[] = [];
      if (audience === "all_customers" || audience === "active_customers") {
        const { data: cs } = await supabase
          .from("customers" as any)
          .select("id, name, phone")
          .eq("organization_id", orgId)
          .not("phone", "is", null)
          .limit(2000);
        list = ((cs ?? []) as any[])
          .filter((c) => c.phone)
          .map((c) => ({ id: c.id, name: c.name, phone: c.phone, source: "customer" }));

        if (audience === "active_customers") {
          // filtra clientes com compra nos últimos 180 dias
          const cutoff = new Date(Date.now() - 180 * 86400000).toISOString();
          const { data: salesData } = await supabase
            .from("sales_orders")
            .select("customer_id, created_at")
            .eq("organization_id", orgId)
            .gte("created_at", cutoff);
          const activeIds = new Set(
            ((salesData ?? []) as any[]).map((s) => s.customer_id).filter(Boolean),
          );
          list = list.filter((t) => activeIds.has(t.id));
        }
      } else if (audience === "all_leads") {
        const { data: ls } = await supabase
          .from("leads")
          .select("id, name, phone")
          .eq("organization_id", orgId)
          .not("phone", "is", null)
          .limit(2000);
        list = ((ls ?? []) as any[])
          .filter((l) => l.phone)
          .map((l) => ({ id: l.id, name: l.name, phone: l.phone, source: "lead" }));
      }
      setTargets(list);
      setLoadingTargets(false);
    })();
  }, [orgId, audience]);

  const preview = useMemo(() => {
    if (!targets[0]) return body;
    return body.replace(/\{\{\s*nome\s*\}\}/gi, targets[0].name.split(" ")[0]);
  }, [body, targets]);

  const send = async () => {
    if (!body.trim()) {
      toast.error("Escreva uma mensagem");
      return;
    }
    if (targets.length === 0) {
      toast.error("Sem destinatários");
      return;
    }
    if (!confirm(`Disparar para ${targets.length} contato(s)? Pode levar alguns minutos.`)) return;

    setSending(true);
    setProgress({ done: 0, failed: 0, total: targets.length });

    let done = 0;
    let failed = 0;

    // Sequencial com pausa leve pra não saturar Evolution.
    for (const t of targets) {
      try {
        const personalized = body.replace(/\{\{\s*nome\s*\}\}/gi, t.name.split(" ")[0]);
        const { error } = await supabase.functions.invoke("send-whatsapp", {
          body: { to: t.phone, text: personalized },
        });
        if (error) throw error;
        done += 1;
      } catch {
        failed += 1;
      }
      setProgress({ done, failed, total: targets.length });
      await new Promise((r) => setTimeout(r, 1200));
    }
    setSending(false);
    toast.success(`Concluído: ${done} enviadas · ${failed} falharam`);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Broadcast" subtitle="Disparo em massa de WhatsApp" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <h2 className="font-black">Compor disparo</h2>
              </div>

              <div>
                <Label>Audiência</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  {(
                    [
                      { id: "active_customers", label: "Clientes ativos (180d)" },
                      { id: "all_customers", label: "Todos clientes" },
                      { id: "all_leads", label: "Todos leads" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setAudience(opt.id as any)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
                        audience === opt.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:border-primary/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="body">Mensagem (use {`{{nome}}`} pra personalizar)</Label>
                <textarea
                  id="body"
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  placeholder="Oi {{nome}}! Temos uma oferta especial pra você esta semana..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <Button onClick={send} disabled={sending || targets.length === 0} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {sending
                  ? `Enviando... ${progress?.done ?? 0} / ${targets.length}`
                  : `Disparar para ${targets.length} contato(s)`}
              </Button>

              {progress && progress.total > 0 && (
                <div className="space-y-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${((progress.done + progress.failed) / progress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-success">
                      <CheckCircle2 className="inline h-3 w-3 mr-1" />
                      {progress.done} enviadas
                    </span>
                    <span className="text-destructive">
                      <AlertCircle className="inline h-3 w-3 mr-1" />
                      {progress.failed} falharam
                    </span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground">
                Disparo sequencial com 1.2s entre mensagens pra não exceder limites do WhatsApp.
                Para evitar bloqueio, segmente bem a audiência e personalize.
              </p>
            </Card>

            <Card className="lg:col-span-2 p-5 bg-muted/30">
              <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" /> Audiência
              </h3>
              <div className="text-3xl font-black mb-2">
                {loadingTargets ? "..." : targets.length}
              </div>
              <p className="text-xs text-muted-foreground mb-4">contatos com telefone válido</p>

              {targets.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-2">
                    Preview p/ primeiro contato
                  </p>
                  <div className="rounded-xl bg-card border border-border p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1">Pra {targets[0].name}</p>
                    <p className="whitespace-pre-wrap">{preview || "..."}</p>
                  </div>
                </>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
