import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClipboardList, Plus, Edit2, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/servicos/checklists")({
  head: () => ({ meta: [{ title: "Checklists OS · ConectaCRM" }] }),
  component: ChecklistsPage,
});

type Checklist = {
  id: string;
  name: string;
  description?: string | null;
  items: string[];
  active: boolean;
};

function ChecklistsPage() {
  const { orgId, userId } = useOrg();
  const [items, setItems] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Checklist | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; items: string[] }>({
    name: "",
    description: "",
    items: [],
  });
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("service_checklists")
      .select("*")
      .eq("organization_id", orgId)
      .order("name");
    setItems(
      (data ?? []).map((c: any) => ({ ...c, items: Array.isArray(c.items) ? c.items : [] })),
    );
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [orgId]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", items: [] });
    setOpen(true);
  };
  const openEdit = (c: Checklist) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? "", items: c.items });
    setOpen(true);
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setForm({ ...form, items: [...form.items, newItem.trim()] });
    setNewItem("");
  };

  const removeItem = (idx: number) => {
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };

  const save = async () => {
    if (!form.name.trim() || !orgId || !userId) return toast.error("Nome obrigatório");
    setSaving(true);
    const payload = {
      ...form,
      organization_id: orgId,
      user_id: userId,
      items: form.items,
      active: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await (supabase as any).from("service_checklists").update(payload).eq("id", editing.id)
      : await (supabase as any).from("service_checklists").insert(payload);
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(editing ? "Atualizado" : "Criado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este checklist?")) return;
    const { error } = await (supabase as any).from("service_checklists").delete().eq("id", id);
    if (error) return toast.error("Erro");
    toast.success("Excluído");
    load();
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Checklists OS" subtitle="Modelos de verificação técnica reutilizáveis" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Novo checklist
            </Button>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : items.length === 0 ? (
            <Card>
              <EmptyState
                icon={ClipboardList}
                title="Nenhum checklist cadastrado"
                description="Crie modelos de verificação técnica (ex: 'iPhone — tela quebrada') pra padronizar OS."
                action={{ label: "Criar primeiro", onClick: openNew }}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((c) => (
                <Card key={c.id} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-black">{c.name}</p>
                      {c.description && (
                        <p className="text-xs text-muted-foreground">{c.description}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="h-7 w-7 grid place-items-center rounded-lg hover:bg-muted"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {c.items.map((it, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded border border-border" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-muted-foreground">{c.items.length} itens</p>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar checklist" : "Novo checklist"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: iPhone tela quebrada"
                autoFocus
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Itens de verificação</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  placeholder="Ex: Testar câmera frontal"
                />
                <Button type="button" variant="outline" onClick={addItem}>
                  Adicionar
                </Button>
              </div>
            </div>
            {form.items.length > 0 && (
              <ul className="space-y-1 max-h-48 overflow-y-auto p-2 rounded-lg bg-muted/30">
                {form.items.map((it, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-muted/50"
                  >
                    <span>
                      {i + 1}. {it}
                    </span>
                    <button onClick={() => removeItem(i)} className="text-destructive p-1">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
