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
import { CreditCard, Plus, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/financeiro/maquininhas")({
  head: () => ({ meta: [{ title: "Maquininhas POS · ConectaCRM" }] }),
  component: TerminalsPage,
});

type Terminal = {
  id: string;
  name: string;
  brand: string;
  acquirer?: string | null;
  serial_number?: string | null;
  rates?: { debito?: number; credito?: number; parcelado?: number; pix?: number } | null;
  active: boolean;
  notes?: string | null;
};

const BRANDS = ["Stone", "Cielo", "Rede", "PagSeguro", "Mercado Pago", "SumUp", "InfinitePay", "Getnet", "Outro"];

function TerminalsPage() {
  const { orgId, userId } = useOrg();
  const [items, setItems] = useState<Terminal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Terminal | null>(null);
  const [form, setForm] = useState<Partial<Terminal>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) { setLoading(false); return; }
    const { data } = await (supabase as any).from("payment_terminals").select("*").eq("organization_id", orgId).order("name");
    setItems((data ?? []) as Terminal[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [orgId]);

  const openNew = () => { setEditing(null); setForm({ active: true, brand: "Stone", rates: { debito: 1.99, credito: 3.99, parcelado: 4.99, pix: 0 } }); setOpen(true); };
  const openEdit = (t: Terminal) => { setEditing(t); setForm(t); setOpen(true); };

  const save = async () => {
    if (!form.name?.trim() || !form.brand?.trim() || !orgId || !userId) return toast.error("Preencha nome e bandeira");
    setSaving(true);
    const payload = { ...form, organization_id: orgId, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = editing
      ? await (supabase as any).from("payment_terminals").update(payload).eq("id", editing.id)
      : await (supabase as any).from("payment_terminals").insert(payload);
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(editing ? "Atualizado" : "Criado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta maquininha?")) return;
    const { error } = await (supabase as any).from("payment_terminals").delete().eq("id", id);
    if (error) return toast.error("Erro");
    toast.success("Excluído");
    load();
  };

  const updateRate = (k: keyof NonNullable<Terminal["rates"]>, v: string) => {
    setForm({ ...form, rates: { ...(form.rates ?? {}), [k]: parseFloat(v) || 0 } });
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Maquininhas POS" subtitle="Cadastre seus terminais e taxas pra calcular líquido das vendas" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">

          <div className="flex justify-end">
            <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova maquininha</Button>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : items.length === 0 ? (
            <Card>
              <EmptyState
                icon={CreditCard}
                title="Nenhuma maquininha cadastrada"
                description="Cadastre as bandeiras e taxas pra simular líquido das vendas e gerar relatório de antecipação."
                action={{ label: "Cadastrar primeira", onClick: openNew }}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((t) => (
                <Card key={t.id} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-black">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.brand}{t.acquirer ? ` · ${t.acquirer}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(t)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-muted"><Edit2 className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(t.id)} className="h-7 w-7 grid place-items-center rounded-lg hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-muted-foreground">Débito</p>
                      <p className="font-black">{(t.rates?.debito ?? 0).toFixed(2)}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-muted-foreground">Crédito</p>
                      <p className="font-black">{(t.rates?.credito ?? 0).toFixed(2)}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-muted-foreground">Parcelado</p>
                      <p className="font-black">{(t.rates?.parcelado ?? 0).toFixed(2)}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-muted-foreground">Pix</p>
                      <p className="font-black">{(t.rates?.pix ?? 0).toFixed(2)}%</p>
                    </div>
                  </div>

                  {t.serial_number && <p className="text-[10px] text-muted-foreground mt-2 font-mono">SN: {t.serial_number}</p>}
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar maquininha" : "Nova maquininha"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome / Identificação *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Stone Loja 1" autoFocus /></div>
            <div>
              <Label>Bandeira *</Label>
              <select value={form.brand ?? "Stone"} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div><Label>Adquirente</Label><Input value={form.acquirer ?? ""} onChange={(e) => setForm({ ...form, acquirer: e.target.value })} placeholder="Ex: Banco do Brasil" /></div>
            <div className="col-span-2"><Label>Número de série</Label><Input value={form.serial_number ?? ""} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
            <div className="col-span-2 pt-2 border-t border-border mt-2">
              <p className="text-xs font-bold mb-2">Taxas (% por transação)</p>
            </div>
            <div><Label>Débito</Label><Input type="number" step="0.01" value={form.rates?.debito ?? 0} onChange={(e) => updateRate("debito", e.target.value)} /></div>
            <div><Label>Crédito à vista</Label><Input type="number" step="0.01" value={form.rates?.credito ?? 0} onChange={(e) => updateRate("credito", e.target.value)} /></div>
            <div><Label>Parcelado</Label><Input type="number" step="0.01" value={form.rates?.parcelado ?? 0} onChange={(e) => updateRate("parcelado", e.target.value)} /></div>
            <div><Label>Pix</Label><Input type="number" step="0.01" value={form.rates?.pix ?? 0} onChange={(e) => updateRate("pix", e.target.value)} /></div>
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
