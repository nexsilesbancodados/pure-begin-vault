import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle2, AlertCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/convite-loja/$token")({
  head: () => ({
    meta: [{ title: "Convite para loja — ConectaCRM" }],
  }),
  component: AcceptOrgInvite,
});

function AcceptOrgInvite() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await (supabase as any)
        .from("organization_invites")
        .select("*, organization:organizations(id, name)")
        .eq("token", token)
        .maybeSingle();
      if (err || !data) { setError("Convite inválido"); setLoading(false); return; }
      if (data.status !== "pending") { setError("Convite já utilizado ou revogado"); setLoading(false); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError("Convite expirado"); setLoading(false); return;
      }
      setInvite(data);
      setOrg(data.organization);
      setLoading(false);
    })();
  }, [token]);

  const accept = async () => {
    if (!user) {
      // redireciona pra login com next param
      navigate({ to: "/login", search: { next: `/convite-loja/${token}` } as any });
      return;
    }
    setAccepting(true);
    const { error: err } = await (supabase as any).rpc("accept_organization_invite", { _token: token });
    setAccepting(false);
    if (err) { toast.error("Erro: " + err.message); return; }
    toast.success("Bem-vindo à loja!");
    setTimeout(() => navigate({ to: "/lojas" }), 800);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-black mb-2">Convite inválido</h1>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Link to="/login" className="text-sm font-bold text-primary hover:underline">
            Ir para login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Store className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Você foi convidado!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Para entrar na loja
          </p>
          <p className="text-lg font-black text-primary mt-1">
            {org?.name ?? "Loja"}
          </p>
          <p className="text-xs text-muted-foreground mt-2 capitalize">
            Como: {invite.role}
          </p>
        </div>

        {!authLoading && !user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Você precisa fazer login ou criar uma conta primeiro.
            </p>
            <Link to="/login" search={{ next: `/convite-loja/${token}` } as any}>
              <Button className="w-full">Entrar / Criar conta</Button>
            </Link>
          </div>
        ) : (
          <Button onClick={accept} disabled={accepting} className="w-full">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {accepting ? "Aceitando..." : "Aceitar e entrar"}
          </Button>
        )}
      </div>
    </div>
  );
}
