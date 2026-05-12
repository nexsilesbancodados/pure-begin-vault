import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Headphones, UserPlus, Shield, Brain, Zap, Sparkles, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

export const Route = createFileRoute("/agentes")({
  head: () => ({ meta: [{ title: "Agentes · ConectaCRM" }] }),
  component: AgentsPage,
});

type Agent = {
  user_id: string;
  role: string;
  is_default: boolean;
  user?: { id: string; display_name: string | null; email: string | null; role: string | null; avatar_url: string | null };
};

function AgentsPage() {
  const { orgId } = useOrg();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    // Membros da org via user_organizations + profiles
    const { data } = await (supabase as any)
      .from("user_organizations")
      .select("user_id, role, is_default, user:profiles!user_organizations_user_id_fkey(id, display_name, email, role, avatar_url)")
      .eq("organization_id", orgId);
    setAgents((data ?? []) as Agent[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Agentes" subtitle="Equipe da sua loja e conexões IA" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Sua equipe ({agents.length})</h2>
            <Link to="/equipe-loja">
              <Button className="gap-2"><UserPlus className="h-4 w-4" /> Convidar membro</Button>
            </Link>
          </div>

          <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-5 shadow-elegant border-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/10 grid place-items-center"><Brain className="h-6 w-6" /></div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80">
                    <Sparkles className="h-3.5 w-3.5" /> IA Configurada
                  </div>
                  <h3 className="text-xl font-bold">Bot de atendimento</h3>
                  <p className="text-sm text-white/70 max-w-lg">
                    Treine respostas automáticas, FAQ e qualificação de leads.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/crm/bot">
                  <Button variant="secondary" className="gap-2"><Zap className="h-4 w-4" /> Configurar bot</Button>
                </Link>
              </div>
            </div>
          </Card>

          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : agents.length === 0 ? (
            <Card>
              <EmptyState
                icon={Headphones}
                title="Nenhum agente na equipe"
                description="Convide membros pra dividir o atendimento por turnos ou especialidades."
                action={{ label: "Convidar primeiro membro", onClick: () => (window.location.href = "/equipe-loja") }}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {agents.map((a) => (
                <Card key={a.user_id} className="p-4 flex items-center gap-4">
                  <div className="relative shrink-0">
                    {a.user?.avatar_url ? (
                      <img src={a.user.avatar_url} className="h-12 w-12 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-gradient-primary text-white font-bold grid place-items-center">
                        {(a.user?.display_name ?? a.user?.email ?? "?").split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-card" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold truncate">{a.user?.display_name ?? a.user?.email ?? "Sem nome"}</p>
                      {a.role === "owner" && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30 flex items-center gap-1">
                          <Shield className="h-2.5 w-2.5" /> Owner
                        </span>
                      )}
                      {a.role !== "owner" && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          {a.role}
                        </span>
                      )}
                      {a.is_default && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-success/10 text-success">Padrão</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{a.user?.email}</p>
                  </div>
                  <Link to="/equipe-loja">
                    <Button variant="outline" size="sm">Editar</Button>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
