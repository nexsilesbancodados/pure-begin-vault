import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Plus,
  Check,
  Building2,
  ArrowRightCircle,
  Edit2,
  LogOut,
  Search,
  Sparkles,
  Crown,
  Users,
  Shield,
} from "lucide-react";
import { useUserOrgs } from "@/lib/useUserOrgs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StoreDetailsDialog } from "@/components/lojas/StoreDetailsDialog";

export const Route = createFileRoute("/lojas")({
  component: LojasPage,
});

function LojasPage() {
  const { orgs, loading, activeOrgId, switchOrg, createOrg, reload } = useUserOrgs();
  const { profile } = useAuth();
  const isSuperAdmin = (profile as any)?.role === "super_admin";
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [query, setQuery] = useState("");
  const [detailsOrg, setDetailsOrg] = useState<{ id: string; name: string; role: string } | null>(
    null,
  );

  const create = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const id = await createOrg(newName.trim());
    setSaving(false);
    if (id) setNewName("");
  };

  const startEdit = (o: any) => {
    setEditingId(o.organization_id);
    setEditName(o.organization?.name ?? "");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const { error } = await (supabase as any).rpc("update_organization_name", {
      _org_id: editingId,
      _name: editName.trim(),
    });
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Nome atualizado");
    setEditingId(null);
    reload();
  };

  const leave = async (orgId: string) => {
    if (!confirm("Sair desta loja? Você perde acesso a todos os dados dela.")) return;
    const { error } = await (supabase as any).rpc("leave_organization", { _org_id: orgId });
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Você saiu da loja");
    setTimeout(() => window.location.reload(), 800);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter((o) =>
      (o.organization?.name ?? "").toLowerCase().includes(q),
    );
  }, [orgs, query]);

  const owned = orgs.filter((o) => o.role === "owner").length;
  const admin = orgs.filter((o) => o.role === "admin").length;

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Minhas Lojas" subtitle="Gerencie múltiplas lojas em uma só conta" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Hero */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground p-7">
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
            <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-bold uppercase tracking-widest">
                  <Sparkles className="h-3.5 w-3.5" /> Multi-loja
                </div>
                <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight">
                  Suas lojas em um só lugar
                </h1>
                <p className="mt-2 text-sm text-primary-foreground/80 max-w-xl">
                  Estoque, vendas, OS e financeiro isolados por loja. Alterne com 1 clique e mantenha
                  cada operação no seu próprio espaço seguro.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 md:min-w-[360px]">
                <Stat icon={Store} label="Lojas" value={orgs.length} />
                <Stat icon={Crown} label="Owner" value={owned} />
                <Stat icon={Shield} label="Admin" value={admin} />
              </div>
            </div>
          </Card>

          {/* Adicionar nova loja */}
          <Card className="p-5 border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center text-primary">
                <Plus className="h-4 w-4" strokeWidth={3} />
              </div>
              <h3 className="font-black text-sm uppercase tracking-widest">Adicionar nova loja</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Ex: Loja Shopping Norte"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                }}
                className="flex-1 h-11"
              />
              <Button
                onClick={create}
                disabled={!newName.trim() || saving}
                className="h-11 px-6 shadow-md"
              >
                {saving ? "Criando..." : "Criar loja"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              Cada loja é isolada: estoque, vendas, OS, financeiro e equipe próprios.
            </p>
          </Card>

          {/* Lojas vinculadas */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                <Store className="h-4 w-4" /> Lojas vinculadas
                <Badge variant="outline" className="ml-1">
                  {orgs.length}
                </Badge>
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar loja..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-3">
                  <Store className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold">
                  {query ? "Nenhuma loja encontrada" : "Nenhuma loja vinculada"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {query ? "Tente outro termo." : "Crie sua primeira loja acima."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filtered.map((o) => {
                  const isActive = o.organization_id === activeOrgId;
                  const isEditing = editingId === o.organization_id;
                  const canEdit = isSuperAdmin || o.role === "owner" || o.role === "admin";
                  return (
                    <div
                      key={o.organization_id}
                      onClick={() => {
                        if (isEditing) return;
                        setDetailsOrg({
                          id: o.organization_id,
                          name: o.organization?.name ?? "Loja",
                          role: o.role,
                        });
                      }}
                      className={`group relative overflow-hidden rounded-2xl border p-4 transition-all cursor-pointer ${
                        isActive
                          ? "border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-md"
                          : "border-border hover:border-primary/40 hover:shadow-md bg-card"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary to-primary/40" />
                      )}

                      <div className="flex items-start gap-3">
                        <div
                          className={`h-12 w-12 rounded-xl grid place-items-center shrink-0 shadow-sm overflow-hidden ${
                            isActive
                              ? "bg-gradient-to-br from-primary to-primary/70 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {o.logo_url ? (
                            <img
                              src={o.logo_url}
                              alt={o.organization?.name ?? "Logo"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Building2 className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <Input
                              value={editName}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter") saveEdit();
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                              className="text-sm h-8"
                            />
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black truncate text-base">
                                {o.organization?.name ?? "Loja sem nome"}
                              </p>
                              {isActive && (
                                <Badge className="bg-success/15 text-success border border-success/30 text-[10px]">
                                  <Check className="h-3 w-3 mr-0.5" /> Ativa
                                </Badge>
                              )}
                              {o.is_default && (
                                <Badge variant="outline" className="text-[10px]">
                                  Padrão
                                </Badge>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 capitalize">
                              {o.role === "owner" ? (
                                <Crown className="h-3 w-3 text-warning" />
                              ) : o.role === "admin" ? (
                                <Shield className="h-3 w-3 text-primary" />
                              ) : (
                                <Users className="h-3 w-3" />
                              )}
                              {o.role}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Button size="sm" onClick={saveEdit} className="h-8">
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                                className="h-8"
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              {canEdit && (
                                <button
                                  onClick={() => startEdit(o)}
                                  className="h-8 w-8 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
                                  title="Editar nome"
                                  aria-label="Editar nome"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => leave(o.organization_id)}
                                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                                title="Sair da loja"
                                aria-label="Sair da loja"
                              >
                                <LogOut className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                        {!isEditing && !isActive && (
                          <Button
                            size="sm"
                            onClick={() => switchOrg(o.organization_id)}
                            className="h-8 shadow-sm"
                          >
                            <ArrowRightCircle className="h-4 w-4 mr-1" /> Acessar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4 bg-muted/40 border-dashed text-xs text-muted-foreground flex gap-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">Como funciona:</strong> ao trocar de loja, o app
              recarrega e todas as telas (estoque, vendas, OS, financeiro) passam a mostrar dados
              daquela loja. Não há mistura de dados entre lojas — cada uma é isolada via RLS.
            </p>
          </Card>
        </main>
      </div>

      {detailsOrg && (
        <StoreDetailsDialog
          open={!!detailsOrg}
          onOpenChange={(v) => !v && setDetailsOrg(null)}
          orgId={detailsOrg.id}
          orgName={detailsOrg.name}
          role={detailsOrg.role}
          onSaved={reload}
        />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary-foreground/80 font-bold">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-2xl font-black mt-0.5">{value}</div>
    </div>
  );
}
