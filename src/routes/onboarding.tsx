import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, Building2, User, Package, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [{ title: "Bem-vindo — ConectaCRM" }, { name: "robots", content: "noindex" }],
  }),
  component: OnboardingPage,
});

const STEPS = [
  { key: "perfil", title: "Seu perfil", icon: User },
  { key: "empresa", title: "Sua empresa", icon: Building2 },
  { key: "primeiro_produto", title: "Primeiro produto", icon: Package },
  { key: "pronto", title: "Tudo pronto", icon: Sparkles },
];

function OnboardingPage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    display_name: "",
    role: "owner",
    company_name: "",
    product_name: "",
    product_price: "",
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user]);

  useEffect(() => {
    if (profile) {
      setData((d) => ({
        ...d,
        display_name: profile.display_name || profile.nome || "",
      }));
    }
  }, [profile]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: data.display_name,
        role: data.role,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar");
    next();
  };

  const saveCompany = async () => {
    if (!profile?.organization_id) {
      next();
      return;
    }
    if (!data.company_name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: data.company_name,
      })
      .eq("id", profile.organization_id);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar empresa");
    next();
  };

  const saveProduct = async () => {
    if (!data.product_name.trim()) {
      next();
      return;
    }
    if (!user?.id || !profile?.organization_id) {
      next();
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("products").insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      name: data.product_name,
      price: parseFloat(data.product_price || "0") || 0,
      category: "Geral",
    });
    setSaving(false);
    if (error) return toast.error("Erro ao criar produto");
    toast.success("Produto criado!");
    next();
  };

  const finish = () => navigate({ to: "/painel" });

  const [seeding, setSeeding] = useState(false);
  const loadDemoData = async () => {
    setSeeding(true);
    try {
      const { data: result, error } = await (supabase as any).rpc("seed_demo_data");
      if (error) {
        toast.error("Não foi possível carregar demo: " + error.message);
      } else if (result?.error) {
        toast.error("Erro: " + result.error);
      } else {
        toast.success(
          `✨ Demo carregado! ${result?.products ?? 0} produtos, ${result?.customers ?? 0} clientes, ${result?.leads ?? 0} leads`,
        );
        setTimeout(() => navigate({ to: "/painel" }), 1000);
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.key} className="flex items-center flex-1">
                <div
                  className={`h-10 w-10 rounded-full grid place-items-center transition-all ${done ? "bg-emerald-500 text-white" : active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : "bg-slate-100 text-slate-400"}`}
                >
                  {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded ${done ? "bg-emerald-500" : "bg-slate-100"}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <Card className="border-border shadow-2xl">
          <CardHeader>
            <h1 className="text-2xl font-semibold tracking-tight leading-none">
              {STEPS[step].title}
            </h1>
            <CardDescription>
              Passo {step + 1} de {STEPS.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Como podemos te chamar?</Label>
                  <Input
                    value={data.display_name}
                    onChange={(e) => setData({ ...data, display_name: e.target.value })}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Seu cargo</Label>
                  <Input
                    value={data.role}
                    onChange={(e) => setData({ ...data, role: e.target.value })}
                    placeholder="Ex: Dono, Gerente..."
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={saveProfile}
                    disabled={saving || !data.display_name.trim()}
                    className="gap-2"
                  >
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Nome da sua empresa</Label>
                  <Input
                    value={data.company_name}
                    onChange={(e) => setData({ ...data, company_name: e.target.value })}
                    placeholder="Ex: Loja do João"
                  />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={back}>
                    Voltar
                  </Button>
                  <Button onClick={saveCompany} disabled={saving} className="gap-2">
                    Continuar <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Cadastre um produto para já testar o PDV (opcional).
                </p>
                <div className="space-y-2">
                  <Label>Nome do produto</Label>
                  <Input
                    value={data.product_name}
                    onChange={(e) => setData({ ...data, product_name: e.target.value })}
                    placeholder="Ex: Cabo USB"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço de venda (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={data.product_price}
                    onChange={(e) => setData({ ...data, product_price: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={back}>
                    Voltar
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={next}>
                      Pular
                    </Button>
                    <Button onClick={saveProduct} disabled={saving} className="gap-2">
                      Continuar <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="text-center py-8 space-y-4">
                <div className="h-16 w-16 rounded-full bg-emerald-100 grid place-items-center mx-auto">
                  <Sparkles className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold">
                  Tudo pronto, {data.display_name || "bem-vindo"}!
                </h3>
                <p className="text-muted-foreground">
                  Sua conta está configurada. Hora de explorar o painel.
                </p>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200 dark:border-amber-700/30 rounded-2xl p-4 my-4 text-left">
                  <p className="text-sm font-bold mb-1">🎁 Carregar dados de exemplo?</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    10 produtos · 4 clientes · 3 leads — pra você testar o PDV, o CRM e os
                    relatórios agora mesmo. Pode remover depois em <strong>Configurações</strong>.
                  </p>
                  <Button
                    onClick={loadDemoData}
                    disabled={seeding}
                    variant="outline"
                    size="sm"
                    className="bg-card"
                  >
                    {seeding ? "Carregando..." : "✨ Carregar demo + ir para o painel"}
                  </Button>
                </div>
                <div className="flex gap-3 justify-center pt-4">
                  <Link to="/equipe">
                    <Button variant="outline">Convidar equipe</Button>
                  </Link>
                  <Button
                    onClick={finish}
                    className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600"
                  >
                    Pular e ir para o painel <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
