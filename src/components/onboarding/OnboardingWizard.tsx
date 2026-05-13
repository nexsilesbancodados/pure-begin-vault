import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Check,
  ChevronRight,
  MessageCircle,
  Users,
  Workflow,
  Zap,
  Loader2,
  Sparkles,
} from "lucide-react";
import { CsvImporter } from "@/components/leads/CsvImporter";

const STORAGE_KEY = "onboarding_done_v1";

const DEFAULT_STAGES = [
  { name: "Novo lead", color: "#3b82f6", order: 1 },
  { name: "Em contato", color: "#8b5cf6", order: 2 },
  { name: "Qualificado", color: "#f59e0b", order: 3 },
  { name: "Proposta", color: "#10b981", order: 4 },
  { name: "Ganho", color: "#22c55e", order: 5 },
  { name: "Perdido", color: "#ef4444", order: 6 },
];

export function OnboardingWizard() {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [showImporter, setShowImporter] = useState(false);

  useEffect(() => {
    if (!user?.id || !profile?.organization_id) return;
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    (async () => {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id);
      if ((count ?? 0) === 0) setOpen(true);
    })();
  }, [user?.id, profile?.organization_id]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setOpen(false);
    toast.success("Tudo pronto! Bem-vindo ao ConectaCRM 🚀");
  };

  const saveOrg = async () => {
    if (!orgName.trim() || !profile?.organization_id) return setStep(2);
    setBusy(true);
    await supabase
      .from("organizations")
      .update({ name: orgName.trim() })
      .eq("id", profile.organization_id);
    setBusy(false);
    setStep(2);
  };

  const saveWhatsapp = async () => {
    if (waNumber.trim() && user?.id && profile?.organization_id) {
      setBusy(true);
      await supabase.from("bot_settings").upsert({
        user_id: user.id,
        organization_id: profile.organization_id,
        whatsapp_instance: waNumber.trim(),
        is_active: true,
      });
      setBusy(false);
    }
    setStep(3);
  };

  const seedFunnel = async () => {
    if (!profile?.organization_id) return setStep(5);
    setBusy(true);
    const { count } = await supabase
      .from("funnel_stages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", profile.organization_id);
    if ((count ?? 0) === 0) {
      await supabase
        .from("funnel_stages")
        .insert(DEFAULT_STAGES.map((s) => ({ ...s, organization_id: profile.organization_id })));
    }
    setBusy(false);
    setStep(5);
  };

  const seedAutomation = async () => {
    if (!user?.id) return finish();
    setBusy(true);
    const { count } = await supabase
      .from("automations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) === 0) {
      await supabase.from("automations").insert({
        user_id: user.id,
        name: "Boas-vindas a novos leads",
        trigger_type: "new_lead",
        action_type: "send_whatsapp",
        config: {
          message:
            "Olá {{nome}}! Recebemos seu contato e em instantes um especialista vai te atender. 🙌",
        },
        is_active: true,
      });
    }
    setBusy(false);
    finish();
  };

  const Stepper = () => (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted">
          <div
            className={`h-full transition-all ${n <= step ? "bg-primary" : ""}`}
            style={{ width: n <= step ? "100%" : "0%" }}
          />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && finish()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" /> Vamos configurar em 2 minutos
            </DialogTitle>
          </DialogHeader>
          <Stepper />

          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">Como se chama sua empresa?</h3>
                  <p className="text-xs text-muted-foreground">
                    Aparece nas notificações e relatórios
                  </p>
                </div>
              </div>
              <div>
                <Label>Nome da empresa</Label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Minha Loja LTDA"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={saveOrg} disabled={busy}>
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">Conecte seu WhatsApp</h3>
                  <p className="text-xs text-muted-foreground">
                    Você pode pular e configurar depois
                  </p>
                </div>
              </div>
              <div>
                <Label>Número (com DDD)</Label>
                <Input
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  placeholder="5511999999999"
                />
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  Pular
                </Button>
                <Button onClick={saveWhatsapp} disabled={busy}>
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">Importe seus leads</h3>
                  <p className="text-xs text-muted-foreground">CSV ou Excel — você pode pular</p>
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <Button onClick={() => setShowImporter(true)} className="gap-2">
                  <Users className="h-4 w-4" /> Importar agora
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Suporta CSV/Excel com colunas Nome, Telefone, Email
                </p>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(4)}>
                  Pular
                </Button>
                <Button onClick={() => setStep(4)}>
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <Workflow className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">Configure o funil padrão</h3>
                  <p className="text-xs text-muted-foreground">
                    Criamos 6 etapas prontas. Você edita depois.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEFAULT_STAGES.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-2 p-2 rounded-lg border border-border"
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                    <span className="text-sm">{s.name}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={() => setStep(5)}>
                  Pular
                </Button>
                <Button onClick={seedFunnel} disabled={busy}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Criar etapas <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">Ative sua primeira automação</h3>
                  <p className="text-xs text-muted-foreground">
                    Mensagem automática de boas-vindas a novos leads
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4 bg-muted/30">
                <div className="text-xs uppercase font-bold text-muted-foreground mb-1">
                  Quando: novo lead chega
                </div>
                <div className="text-sm">
                  Envia: <em>"Olá &#123;&#123;nome&#125;&#125;! Recebemos seu contato..."</em>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={finish}>
                  Pular
                </Button>
                <Button onClick={seedAutomation} disabled={busy} className="gap-2">
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" /> Ativar e finalizar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showImporter && <CsvImporter open={showImporter} onClose={() => setShowImporter(false)} />}
    </>
  );
}
