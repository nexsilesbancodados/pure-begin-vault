import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScrollText, Plus, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/servicos/termos")({
  head: () => ({ meta: [{ title: "Termos de Garantia · ConectaCRM" }] }),
  component: WarrantyPage,
});

type Warranty = { id: string; name: string; category: string; days: number; content: string; active: boolean };

const CATEGORIES = ["Aparelho lacrado", "Aparelho seminovo", "Reparo (assistência)", "Acessório", "Personalizado"];

function WarrantyPage() {
  const { orgId, userId } = useOrg();
  const [items, setItems] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Warranty | null>(null);
  const [form, setForm] = useState<Partial<Warranty>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) { setLoading(false); return; }
    const { data } = await (supabase as any).from("warranty_terms").select("*").eq("organization_id", orgId).order("name");
    setItems((data ?? []) as Warranty[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [orgId]);

  const openNew = () => { setEditing(null); setForm({ category: CATEGORIES[0], days: 90, content: defaultContent(90), active: true }); setOpen(true); };
  const openEdit = (w: Warranty) => { setEditing(w); setForm(w); setOpen(true); };

  const save = async () => {
    if (!form.name?.trim() || !form.content?.trim() || !orgId || !userId) return toast.error("Preencha nome e conteúdo");
    setSaving(true);
    const payload = { ...form, organization_id: orgId, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = editing
      ? await (supabase as any).from("warranty_terms").update(payload).eq("id", editing.id)
      : await (supabase as any).from("warranty_terms").insert(payload);
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(editing ? "Atualizado" : "Criado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este termo?")) return;
    const { error } = await (supabase as any).from("warranty_terms").delete().eq("id", id);
    if (error) return toast.error("Erro");
    toast.success("Excluído");
    load();
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Termos de Garantia" subtitle="Modelos de garantia pra venda e assistência" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          <div className="flex justify-end">
            <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo termo</Button>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : items.length === 0 ? (
            <Card>
              <EmptyState
                icon={ScrollText}
                title="Nenhum termo cadastrado"
                description="Crie modelos de garantia pra imprimir junto com vendas (lacrado, seminovo, reparo)."
                action={{ label: "Criar primeiro", onClick: openNew }}
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map((w) => (
                <Card key={w.id} className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-black">{w.name}</p>
                      <p className="text-xs text-muted-foreground">{w.category} · {w.days} dias</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(w)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(w.id)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">{w.content}</div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar termo" : "Novo termo de garantia"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>Nome *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
              <div>
                <Label>Categoria</Label>
                <select value={form.category ?? CATEGORIES[0]} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>Dias de garantia</Label>
                <Input type="number" value={form.days ?? 90} onChange={(e) => setForm({ ...form, days: parseInt(e.target.value) || 0 })} />
              </div>
              <Button type="button" variant="outline" onClick={() => setForm({ ...form, content: defaultContent(form.days ?? 90) })}>
                Inserir modelo padrão
              </Button>
            </div>
            <div>
              <Label>Conteúdo do termo *</Label>
              <Textarea rows={10} value={form.content ?? ""} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Texto que será impresso..." />
              <p className="text-[11px] text-muted-foreground mt-1">Use as variáveis: {"{cliente}, {produto}, {data}, {dias}, {loja}"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.name?.trim() || !form.content?.trim()}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function defaultContent(days: number): string {
  return `TERMO DE GARANTIA

A loja {loja} concede a {cliente} a garantia de ${days} dias para o produto {produto}, adquirido em {data}.

A garantia cobre defeitos de fabricação e mau funcionamento decorrentes do uso normal do produto. Não cobre:
- Danos físicos (queda, impacto, líquidos)
- Mau uso ou tentativa de reparo por terceiros
- Bateria após 30 dias (consumível)
- Acessórios e películas (consumíveis)

Para acionar a garantia, o cliente deve trazer o produto à loja com este termo. O atendimento será em ${days <= 30 ? "até 3 dias" : "até 7 dias úteis"}.

Data: {data}
Cliente: {cliente}
Assinatura: _________________________________`;
}
