import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Truck, Plus, Edit2, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/financeiro/fornecedores")({
  head: () => ({ meta: [{ title: "Fornecedores · ConectaCRM" }] }),
  component: SuppliersPage,
});

type Supplier = {
  id: string;
  name: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  active: boolean;
};

function SuppliersPage() {
  const { orgId, userId } = useOrg();
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Partial<Supplier>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) { setLoading(false); return; }
    const { data } = await (supabase as any).from("suppliers").select("*").eq("organization_id", orgId).order("name");
    setItems((data ?? []) as Supplier[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [orgId]);

  const openNew = () => { setEditing(null); setForm({ active: true }); setOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm(s); setOpen(true); };

  const save = async () => {
    if (!form.name?.trim() || !orgId || !userId) return toast.error("Nome obrigatório");
    setSaving(true);
    const payload = { ...form, organization_id: orgId, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = editing
      ? await (supabase as any).from("suppliers").update(payload).eq("id", editing.id)
      : await (supabase as any).from("suppliers").insert(payload);
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(editing ? "Atualizado" : "Criado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este fornecedor?")) return;
    const { error } = await (supabase as any).from("suppliers").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir");
    toast.success("Excluído");
    load();
  };

  const filtered = items.filter((s) =>
    !q ? true : (s.name + (s.cnpj ?? "") + (s.contact_name ?? "") + (s.city ?? "")).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Fornecedores" subtitle="Cadastro de fornecedores e contatos" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, CNPJ, cidade..." className="pl-10 h-10" />
            </div>
            <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo fornecedor</Button>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={Truck}
                title={q ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
                description={q ? "Tente outra busca." : "Cadastre fornecedores pra registrar entradas de NF e relatório de compras."}
                action={!q ? { label: "Cadastrar primeiro", onClick: openNew } : undefined}
              />
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Nome</th>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">CNPJ</th>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Contato</th>
                    <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Cidade/UF</th>
                    <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-border hover:bg-muted/20">
                      <td className="p-3 font-bold">{s.name}</td>
                      <td className="p-3 font-mono text-xs">{s.cnpj}</td>
                      <td className="p-3">{s.contact_name ?? s.email ?? s.phone}</td>
                      <td className="p-3 text-muted-foreground">{[s.city, s.state].filter(Boolean).join("/")}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => openEdit(s)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-muted inline-flex">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => remove(s.id)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive inline-flex ml-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome / Razão Social *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" /></div>
            <div><Label>Contato</Label><Input value={form.contact_name ?? ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Cidade</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>UF</Label><Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} /></div>
            <div className="col-span-2"><Label>Observações</Label><Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.name?.trim()}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
