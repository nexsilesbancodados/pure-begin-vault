import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, ArrowLeft, CheckCircle2, Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import { ensureMercadoPagoSdk } from "@/lib/mercadoPagoSdk";

const MP_PUBLIC_KEY = "APP_USR-c09d032c-d0b8-424a-ae0e-5054cf8fd581";

declare global { interface Window { MercadoPago?: any; brickCtl?: any } }

type Plan = {
  id: string; slug: string; name: string; description: string | null;
  price_cents: number; currency: string; interval: string;
  features: string[]; sort_order: number;
};

export const Route = createFileRoute("/assinar")({
  head: () => ({
    meta: [
      { title: "Assinar — ConectaCRM" },
      { name: "description", content: "Crie sua conta após o pagamento. Checkout seguro via Mercado Pago." },
      { property: "og:title", content: "Comece agora no ConectaCRM" },
      { property: "og:description", content: "Cartão, PIX ou boleto. Acesso liberado na hora." },
    ],
  }),
  component: AssinarPage,
});

function brl(c: number) { return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function AssinarPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"plan" | "info" | "pay" | "result">("plan");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("plans").select("*").eq("is_active", true).order("sort_order");
      setPlans((data || []) as Plan[]);
      setLoading(false);
    })();
  }, []);

  function selectPlan(p: Plan) { setPlan(p); setStep("info"); }
  function submitInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast.error("Preencha nome e e-mail."); return; }
    setStep("pay");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Já tenho conta</Link>
        </div>

        {/* Stepper */}
        <ol className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-10">
          <li className={step === "plan" ? "text-primary font-semibold" : ""}>1. Plano</li>
          <span>›</span>
          <li className={step === "info" ? "text-primary font-semibold" : ""}>2. Seus dados</li>
          <span>›</span>
          <li className={step === "pay" ? "text-primary font-semibold" : ""}>3. Pagamento</li>
          <span>›</span>
          <li className={step === "result" ? "text-primary font-semibold" : ""}>4. Acesso</li>
        </ol>

        {step === "plan" && (
          <>
            <h1 className="text-3xl md:text-4xl font-bold text-center mb-2">
              Escolha seu <span className="text-gradient-primary">plano</span>
            </h1>
            <p className="text-center text-muted-foreground mb-10">
              Sua conta será criada automaticamente após a confirmação do pagamento.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((p) => {
                const featured = p.slug === "professional";
                return (
                  <Card key={p.id} className={`relative flex flex-col ${featured ? "border-primary shadow-elegant scale-[1.02]" : ""}`}>
                    {featured && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">Mais popular</Badge>}
                    <CardHeader>
                      <CardTitle className="text-2xl">{p.name}</CardTitle>
                      <CardDescription>{p.description}</CardDescription>
                      <div className="pt-4">
                        <span className="text-4xl font-bold">{brl(p.price_cents)}</span>
                        <span className="text-muted-foreground">/{p.interval === "month" ? "mês" : p.interval}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <ul className="space-y-2 flex-1">
                        {(p.features || []).map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Button className="mt-6 w-full" variant={featured ? "default" : "outline"} onClick={() => selectPlan(p)}>
                        Assinar {p.name}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {step === "info" && plan && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <h1 className="text-2xl font-semibold tracking-tight">Seus dados</h1>
              <CardDescription>
                Plano <strong>{plan.name}</strong> — {brl(plan.price_cents)}/{plan.interval === "month" ? "mês" : plan.interval}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitInfo} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail (será seu login)</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone (opcional)</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("plan")}>Voltar</Button>
                  <Button type="submit" className="flex-1">Ir para pagamento</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {step === "pay" && plan && (
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <h1 className="text-2xl font-semibold tracking-tight">Pagamento</h1>
              <CardDescription>
                {plan.name} — {brl(plan.price_cents)} • {form.email}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentBrick
                plan={plan}
                form={form}
                onResult={(r) => { setResult(r); setStep("result"); }}
                onBack={() => setStep("info")}
              />
            </CardContent>
          </Card>
        )}

        {step === "result" && (
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <h1 className="text-2xl font-semibold tracking-tight">Resultado do pagamento</h1>
            </CardHeader>
            <CardContent className="pt-2">
              <ResultView result={result} email={form.email} onRetry={() => setStep("pay")} navigateLogin={() => navigate({ to: "/login" })} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PaymentBrick({ plan, form, onResult, onBack }: {
  plan: Plan; form: { name: string; email: string; phone: string };
  onResult: (r: any) => void; onBack: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    let cancelled = false;
    const init = async () => {
      try {
        await ensureMercadoPagoSdk();
      } catch (error: any) {
        toast.error(error?.message || "Falha ao carregar Mercado Pago");
        return;
      }
      if (cancelled || !window.MercadoPago) return;
      const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });
      const bricks = mp.bricks();
      try { await window.brickCtl?.unmount?.(); } catch {}
      window.brickCtl = await bricks.create("payment", "mp-brick-signup", {
        initialization: { amount: plan.price_cents / 100, payer: { email: form.email } },
        customization: {
          paymentMethods: { creditCard: "all", debitCard: "all", bankTransfer: "all", ticket: "all" },
          visual: { style: { theme: "default" } },
        },
        callbacks: {
          onReady: () => setReady(true),
          onError: (err: any) => { console.error(err); toast.error(err?.message || "Erro no pagamento"); },
          onSubmit: async ({ formData }: any) => {
            setSubmitting(true);
            try {
              const { data, error } = await supabase.functions.invoke("mp-checkout-signup", {
                body: {
                  plan_slug: plan.slug,
                  name: form.name,
                  email: form.email,
                  phone: form.phone,
                  formData,
                  redirect_to: `${window.location.origin}/painel`,
                },
                headers: { "x-idempotency-key": crypto.randomUUID() },
              });
              if (error) throw error;
              onResult(data);
            } catch (e: any) {
              toast.error(e?.message || "Erro ao processar pagamento");
              throw e;
            } finally { setSubmitting(false); }
          },
        },
      });
      initialized.current = true;
    };
    init();
    return () => { cancelled = true; try { window.brickCtl?.unmount?.(); } catch {} initialized.current = false; };
  }, [plan.id]);

  return (
    <div>
      {!ready && <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      <div id="mp-brick-signup" />
      {submitting && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
          <Loader2 className="h-4 w-4 animate-spin" /> Processando pagamento e criando sua conta…
        </div>
      )}
      <Button variant="outline" size="sm" className="mt-4" onClick={onBack} disabled={submitting}>Voltar</Button>
    </div>
  );
}

function ResultView({ result, email, onRetry, navigateLogin }: {
  result: any; email: string; onRetry: () => void; navigateLogin: () => void;
}) {
  if (!result) return <p>Sem resultado.</p>;

  // Cartão aprovado → conta criada e magic link disponível
  if (result.status === "approved" && result.account?.action_link) {
    return (
      <div className="text-center">
        <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
        <h3 className="text-xl font-semibold mt-4">Pagamento aprovado!</h3>
        <p className="text-sm text-muted-foreground mt-1">Sua conta foi criada para <strong>{email}</strong>.</p>
        <Button asChild className="mt-6 w-full"><a href={result.account.action_link}>Acessar minha conta</a></Button>
        <p className="text-xs text-muted-foreground mt-3">Também enviamos um link de acesso para o seu e-mail.</p>
      </div>
    );
  }

  // PIX
  if (result.qr_code) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-semibold">Pague com PIX para liberar sua conta</h3>
        {result.qr_code_base64 && (
          <img src={`data:image/png;base64,${result.qr_code_base64}`} alt="QR Code PIX para pagamento da assinatura" className="w-64 h-64 mx-auto mt-4 border rounded" />
        )}
        <p className="text-xs text-muted-foreground mt-3">Ou copie o código:</p>
        <div className="flex gap-2 mt-2">
          <input readOnly value={result.qr_code} className="flex-1 px-3 py-2 text-xs border rounded bg-muted font-mono" />
          <Button size="sm" variant="outline" aria-label="Copiar código PIX" onClick={() => { navigator.clipboard.writeText(result.qr_code); toast.success("Copiado!"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-6 p-3 rounded bg-muted text-left text-sm flex gap-2">
          <Mail className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>Assim que confirmarmos o pagamento, enviaremos um link de acesso para <strong>{email}</strong>.</span>
        </div>
      </div>
    );
  }

  // Boleto
  if (result.boleto_url) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-semibold">Boleto gerado</h3>
        <p className="text-sm text-muted-foreground mt-1">Após o pagamento, sua conta será liberada e enviaremos o acesso por e-mail.</p>
        <Button asChild className="mt-4"><a href={result.boleto_url} target="_blank" rel="noreferrer">Abrir boleto</a></Button>
      </div>
    );
  }

  // Pendente sem instrução / processando
  if (result.status === "pending" || result.status === "in_process") {
    return (
      <div className="text-center">
        <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
        <h3 className="text-lg font-semibold mt-4">Pagamento em análise</h3>
        <p className="text-sm text-muted-foreground mt-1">Avisaremos por e-mail ({email}) assim que for aprovado.</p>
      </div>
    );
  }

  // Falhou
  return (
    <div className="text-center">
      <h3 className="text-lg font-semibold text-destructive">Pagamento {result.status || "recusado"}</h3>
      <p className="text-sm text-muted-foreground mt-1">{result.status_detail || "Tente outro método de pagamento."}</p>
      <Button onClick={onRetry} className="mt-4">Tentar novamente</Button>
      <Button variant="ghost" onClick={navigateLogin} className="mt-2">Já tenho conta</Button>
    </div>
  );
}
