import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Store, Plus, Check, Building2, ArrowRightCircle } from "lucide-react";
import { useUserOrgs } from "@/lib/useUserOrgs";

export const Route = createFileRoute("/lojas")({
  component: LojasPage,
});

function LojasPage() {
  const { orgs, loading, activeOrgId, switchOrg, createOrg } = useUserOrgs();
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const id = await createOrg(newName.trim());
    setSaving(false);
    if (id) setNewName("");
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Minhas Lojas" subtitle="Gerencie múltiplas lojas em uma só conta" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Adicionar nova loja
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Loja Shopping Norte"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                className="flex-1"
              />
              <Button onClick={create} disabled={!newName.trim() || saving}>
                {saving ? "Criando..." : "Criar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cada loja tem estoque, vendas, OS, financeiro e equipe independentes.
              Você alterna entre elas pelo seletor no topo.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <Store className="h-4 w-4" /> Lojas vinculadas
              </h3>
              <Badge variant="outline">{orgs.length}</Badge>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhuma loja vinculada. Crie sua primeira acima.
              </p>
            ) : (
              <div className="space-y-2">
                {orgs.map((o) => {
                  const isActive = o.organization_id === activeOrgId;
                  return (
                    <div
                      key={o.organization_id}
                      className={`flex items-center justify-between p-4 rounded-xl border ${
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30 transition"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black truncate">
                            {o.organization?.name ?? "Loja sem nome"}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            Papel: {o.role}{o.is_default && " · padrão"}
                          </p>
                        </div>
                      </div>
                      {isActive ? (
                        <Badge className="bg-success/15 text-success">
                          <Check className="h-3 w-3 mr-1" /> Ativa
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => switchOrg(o.organization_id)}
                        >
                          <ArrowRightCircle className="h-4 w-4 mr-1" /> Acessar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4 bg-muted/40 text-xs text-muted-foreground">
            <p>
              <strong>Como funciona:</strong> ao trocar de loja, o app recarrega e todas as
              telas (estoque, vendas, OS, financeiro) passam a mostrar dados daquela loja.
              Não há mistura de dados entre lojas — cada uma é isolada via RLS.
            </p>
          </Card>
        </main>
      </div>
    </div>
  );
}
