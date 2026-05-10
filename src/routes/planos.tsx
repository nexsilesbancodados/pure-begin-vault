import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

type Search = { status?: "success" | "failure" | "pending" };

export const Route = createFileRoute("/planos")({
  component: PlanosPage,
  validateSearch: (s: Record<string, unknown>): Search => ({
    status: (s.status as Search["status"]) || undefined,
  }),
});

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PlanosPage() {
  const navigate = useNavigate();
  const { status } = useSearch({ from: "/planos" });
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);

  useEffect(() => {
    if (status === "success") toast.success("Pagamento aprovado! Sua assinatura está ativa.");
    if (status === "failure") toast.error("Pagamento recusado. Tente outro método.");
    if (status === "pending") toast("Pagamento pendente — aguardando confirmação.");
  }, [status]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        toast.error("Erro ao carregar planos: " + error.message);
      } else {
        setPlans((data || []) as Plan[]);
      }
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("status, plans:plan_id(slug)")
          .eq("user_id", u.user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        // @ts-expect-error nested select
        if (sub?.plans?.slug) setCurrentSlug(sub.plans.slug);
      }
      setLoading(false);
    })();
  }, []);

  async function subscribe(plan: Plan) {
    try {
      setPaying(plan.slug);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Faça login para assinar.");
        navigate({ to: "/login" });
        return;
      }
      const { data, error } = await supabase.functions.invoke("mp-create-preference", {
        body: {
          plan_slug: plan.slug,
          success_url: `${window.location.origin}/planos?status=success`,
          failure_url: `${window.location.origin}/planos?status=failure`,
          pending_url: `${window.location.origin}/planos?status=pending`,
        },
      });
      if (error) throw error;
      const url = (data as any)?.init_point || (data as any)?.sandbox_init_point;
      if (!url) throw new Error("Mercado Pago não retornou URL de checkout");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar checkout");
    } finally {
      setPaying(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Escolha seu <span className="text-gradient-primary">plano</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Pagamento seguro via Mercado Pago. Cartão, PIX ou boleto. Cancele quando quiser.
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
                      <span className="text-muted-foreground">/{p.interval === "month" ? "mês" : p.interval}</span>
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
                      disabled={paying !== null || isCurrent}
                      onClick={() => subscribe(p)}
                    >
                      {isCurrent ? "Plano atual" : paying === p.slug ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Redirecionando…</>
                      ) : "Assinar"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-10">
          Pagamentos processados por Mercado Pago. Você será redirecionado para concluir a compra.
        </p>
      </div>
    </div>
  );
}
