import { useAuth, type UserPermissions } from "@/contexts/AuthContext";
import { Lock, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

type PermKey = keyof UserPermissions;

interface RequirePermissionProps {
  perm: PermKey;
  children: React.ReactNode;
}

export function RequirePermission({ perm, children }: RequirePermissionProps) {
  const { permissions, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando permissões...
      </div>
    );
  }

  // Sem permissions ainda = usuário não autenticado totalmente; deixa o AuthContext lidar.
  if (!permissions) return <>{children}</>;

  if (!permissions[perm]) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-md text-center">
          <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-black mb-2">Acesso restrito</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Você não tem permissão para acessar esta área. Solicite ao administrador da empresa em
            Equipe / Permissões.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              to="/painel"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition"
            >
              Voltar ao painel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
