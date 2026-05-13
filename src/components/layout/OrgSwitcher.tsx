import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Store, Check, Plus, ChevronDown, Building2 } from "lucide-react";
import { useUserOrgs } from "@/lib/useUserOrgs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function OrgSwitcher() {
  const { orgs, loading, activeOrgId, switchOrg, createOrg } = useUserOrgs();
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const active = orgs.find((o) => o.organization_id === activeOrgId);
  const activeName = active?.organization?.name ?? "Sem loja";

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const id = await createOrg(name.trim());
    setSaving(false);
    if (id) {
      setOpenCreate(false);
      setName("");
    }
  };

  if (loading) {
    return (
      <div className="h-9 px-3 rounded-lg bg-muted text-xs font-bold flex items-center gap-2 animate-pulse">
        <Store className="h-3.5 w-3.5" />
        Carregando lojas...
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-9 px-3 rounded-lg bg-card border border-border hover:border-primary/40 transition text-xs font-bold flex items-center gap-2 max-w-[200px]">
            <Store className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">{activeName}</span>
            {orgs.length > 1 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                {orgs.length}
              </span>
            )}
            <ChevronDown className="h-3 w-3 ml-auto shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest">
            Suas lojas ({orgs.length})
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orgs.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              Nenhuma loja vinculada
            </div>
          ) : (
            orgs.map((o) => {
              const isActive = o.organization_id === activeOrgId;
              return (
                <DropdownMenuItem
                  key={o.organization_id}
                  onClick={() => {
                    if (!isActive) switchOrg(o.organization_id);
                  }}
                  className="flex items-center gap-2"
                  disabled={isActive}
                >
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">
                      {o.organization?.name ?? "Sem nome"}
                    </p>
                    <p className="text-[9px] text-muted-foreground capitalize">{o.role}</p>
                  </div>
                  {isActive && <Check className="h-3.5 w-3.5 text-success shrink-0" />}
                </DropdownMenuItem>
              );
            })
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpenCreate(true)} className="text-primary">
            <Plus className="h-3.5 w-3.5 mr-2" /> Adicionar nova loja
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova loja</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="org-name">Nome da loja</Label>
              <Input
                id="org-name"
                placeholder="Ex: Loja Centro"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Cada loja tem estoque, vendas e financeiro independentes. Você pode alternar entre
                elas a qualquer momento.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving || !name.trim()}>
              {saving ? "Criando..." : "Criar loja"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
