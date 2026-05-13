import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { MpPaymentBrick } from "@/components/billing/MpPaymentBrick";

type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  interval: string;
  features: string[];
  sort_order: number;
};

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos e preços — ConectaCRM" },
      {
        name: "description",
        content:
          "Compare os planos do ConectaCRM e escolha o ideal para sua loja: estoque IMEI, OS, vendas, fiscal, CRM e IA.",
      },
      { property: "og:title", content: "Planos ConectaCRM" },
      {
        property: "og:description",
        content: "Starter, Professional e Business — escolha seu plano e comece hoje.",
      },
    ],
  }),
  component: PlanosPage,
});

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PlanosPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) toast.error("Erro ao carregar planos: " + error.message);
      else setPlans((data || []) as Plan[]);

      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        setUserEmail(u.user.email || "");
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status, plans:plan_id(slug)")
          .eq("user_id", u.user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        // @ts-expect-error nested
        if (sub?.plans?.slug) setCurrentSlug(sub.plans.slug);
      }
      setLoading(false);
    })();
  }, []);

  async function startCheckout(p: Plan) {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      toast.error("Faça login para assinar.");
      navigate({ to: "/login" });
      return;
    }
    setSelected(p);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Escolha seu <span className="text-gradient-primary">plano</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Pagamento seguro pelo nosso site via Mercado Pago — Cartão, PIX ou Boleto. Sem redirect.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((p) => {
              const isCurrent = currentSlug === p.slug;
              const featured = p.slug === "professional";
              return (
                <Card
                  key={p.id}
                  className={`relative flex flex-col ${featured ? "border-primary shadow-elegant scale-[1.02]" : ""}`}
                >
                  {featured && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Mais popular
                    </Badge>
                  )}
                  <CardHeader>
                    <CardTitle className="text-2xl">{p.name}</CardTitle>
                    <CardDescription>{p.description}</CardDescription>
                    <div className="pt-4">
                      <span className="text-4xl font-bold">{formatBRL(p.price_cents)}</span>
                      <span className="text-muted-foreground">
                        /{p.interval === "month" ? "mês" : p.interval}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-2 flex-1">
                      {(p.features || []).map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-6 w-full"
                      variant={featured ? "default" : "outline"}
                      disabled={isCurrent}
                      onClick={() => startCheckout(p)}
                    >
                      {isCurrent ? "Plano atual" : "Assinar"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-10">
          Pagamentos processados por Mercado Pago. Seus dados de cartão são criptografados e nunca
          passam pelos nossos servidores.
        </p>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagamento — {selected?.name}</DialogTitle>
            <DialogDescription>
              {selected &&
                `${formatBRL(selected.price_cents)} / ${selected.interval === "month" ? "mês" : selected.interval}`}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <MpPaymentBrick
              planSlug={selected.slug}
              amount={Number((selected.price_cents / 100).toFixed(2))}
              payerEmail={userEmail}
              onSuccess={() => {
                setCurrentSlug(selected.slug);
                setTimeout(() => setSelected(null), 2500);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
