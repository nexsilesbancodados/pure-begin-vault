import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { RequirePermission } from "@/components/layout/RequirePermission";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield, Search, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

export const Route = createFileRoute("/audit-log")({
  component: () => (
    <RequirePermission perm="configuracoes">
      <AuditLogPage />
    </RequirePermission>
  ),
});

type Log = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: any;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criou",
  update: "Atualizou",
  delete: "Removeu",
  view: "Visualizou",
  login: "Login",
  logout: "Logout",
  send_message: "Enviou mensagem",
  create_os: "Criou OS",
  close_sale: "Fechou venda",
  discount_approval: "Aprovou desconto",
  refund: "Reembolsou",
  permission_change: "Alterou permissão",
};

const ACTION_COLOR: Record<string, string> = {
  delete: "bg-destructive/10 text-destructive",
  permission_change: "bg-warning/10 text-warning",
  discount_approval: "bg-warning/10 text-warning",
  refund: "bg-warning/10 text-warning",
  default: "bg-muted text-muted-foreground",
};

function AuditLogPage() {
  const { orgId } = useOrg();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (supabase as any)
      .from("audit_logs")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error: err }: any) => {
        if (err) {
          setError(
            "Tabela audit_logs não encontrada. Aplique a migration 20260512020000_features_extras.sql via Supabase Studio."
          );
          setLoading(false);
          return;
        }
        setLogs((data as Log[]) ?? []);
        setLoading(false);
      });
  }, [orgId]);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.entity_type.toLowerCase().includes(q) ||
      (l.entity_id?.toLowerCase() ?? "").includes(q)
    );
  });

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Auditoria" subtitle="Histórico de ações do sistema" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          {error ? (
            <Card className="p-5 border-warning/30 bg-warning/5">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-black mb-1">Audit log não habilitado</p>
                  <p className="text-muted-foreground">{error}</p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              <Card className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por ação, tipo de entidade ou ID..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </Card>

              <Card className="p-4">
                {loading ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Carregando...
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhum log encontrado.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {filtered.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition"
                      >
                        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              className={`${
                                ACTION_COLOR[l.action] ?? ACTION_COLOR.default
                              } text-[10px]`}
                            >
                              {ACTION_LABELS[l.action] ?? l.action}
                            </Badge>
                            <span className="text-sm font-bold">{l.entity_type}</span>
                            {l.entity_id && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{l.entity_id.slice(0, 8)}
                              </span>
                            )}
                          </div>
                          {l.metadata && Object.keys(l.metadata).length > 0 && (
                            <pre className="text-[10px] text-muted-foreground mt-1 font-mono overflow-x-auto">
                              {JSON.stringify(l.metadata, null, 0)}
                            </pre>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(l.created_at).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    ))}
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
