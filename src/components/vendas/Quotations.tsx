import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Printer, Send, ShoppingCart, FileText, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/EmptyState";

type QuotationItem = { name: string; qty: number; price: number };
type Quotation = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  items: QuotationItem[];
  total: number;
  status: string;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
};

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function Quotations() {
  const { orgId, userId } = useOrg();
  const [items, setItems] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Quotation>>({});
  const [draftItems, setDraftItems] = useState<QuotationItem[]>([]);
  const [newItem, setNewItem] = useState<QuotationItem>({ name: "", qty: 1, price: 0 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) { setLoading(false); return; }
    const { data } = await (supabase as any).from("quotations").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100);
    setItems((data ?? []).map((q: any) => ({ ...q, items: Array.isArray(q.items) ? q.items : [] })));
    setLoading(false);
  };
  useEffect(() => { load(); }, [orgId]);

  const subtotal = draftItems.reduce((a, i) => a + i.qty * i.price, 0);

  const openNew = () => {
    setForm({ customer_name: "", customer_phone: "", notes: "" });
    setDraftItems([]);
    setNewItem({ name: "", qty: 1, price: 0 });
    setOpen(true);
  };

  const addItem = () => {
    if (!newItem.name.trim() || newItem.qty <= 0 || newItem.price < 0) return;
    setDraftItems([...draftItems, newItem]);
    setNewItem({ name: "", qty: 1, price: 0 });
  };
  const removeItem = (i: number) => setDraftItems(draftItems.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.customer_name?.trim()) return toast.error("Nome do cliente obrigatório");
    if (draftItems.length === 0) return toast.error("Adicione ao menos 1 item");
    if (!orgId || !userId) return;
    setSaving(true);
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { error } = await (supabase as any).from("quotations").insert({
      organization_id: orgId,
      user_id: userId,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      items: draftItems,
      subtotal,
      total: subtotal,
      status: "aberto",
      expires_at: expires,
      notes: form.notes,
    });
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Orçamento criado");
    setOpen(false);
    load();
  };

  const print = (qu: Quotation) => {
    window.open(`/orcamento/${qu.id}`, "_blank");
  };

  const sendWhatsApp = (qu: Quotation) => {
    const phone = (qu.customer_phone ?? "").replace(/\D/g, "");
    if (!phone) return toast.error("Cliente sem telefone");
    const link = `${window.location.origin}/orcamento/${qu.id}`;
    const msg = `Olá ${qu.customer_name}! Segue seu orçamento: ${link}\nTotal: ${BRL(qu.total)}\nVálido até ${qu.expires_at ? new Date(qu.expires_at).toLocaleDateString("pt-BR") : "—"}`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const convertToSale = async (qu: Quotation) => {
    if (!confirm(`Converter este orçamento em venda no PDV?`)) return;
    // Marca como convertido + redireciona PDV com itens pré-carregados via query
    const itemsParam = encodeURIComponent(JSON.stringify(qu.items));
    await (supabase as any).from("quotations").update({ status: "convertido", updated_at: new Date().toISOString() }).eq("id", qu.id);
    toast.success("Indo pro PDV com itens...");
    window.location.href = `/pdv?quote=${qu.id}&customer=${encodeURIComponent(qu.customer_name)}&items=${itemsParam}`;
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este orçamento?")) return;
    await (supabase as any).from("quotations").delete().eq("id", id);
    toast.success("Excluído");
    load();
  };

  const filtered = items.filter((i) =>
    !q ? true : (i.customer_name + (i.customer_phone ?? "")).toLowerCase().includes(q.toLowerCase())
  );

  const statusColor = (s: string) => {
    if (s === "aberto") return "bg-info/10 text-info border-info/30";
    if (s === "enviado") return "bg-warning/10 text-warning border-warning/30";
    if (s === "aceito" || s === "convertido") return "bg-success/10 text-success border-success/30";
    if (s === "recusado" || s === "expirado") return "bg-destructive/10 text-destructive border-destructive/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente..." className="pl-10 h-10" />
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo orçamento</Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Nenhum orçamento"
            description="Crie orçamentos com validade de 7 dias e envie pro cliente via WhatsApp. Aceitos viram venda no PDV em 1 clique."
            action={{ label: "Criar primeiro", onClick: openNew }}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Cliente</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Itens</th>
                <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">Total</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Status</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Validade</th>
                <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((qu) => (
                <tr key={qu.id} className="border-b hover:bg-muted/20">
                  <td className="p-3">
                    <p className="font-bold">{qu.customer_name}</p>
                    {qu.customer_phone && <p className="text-xs text-muted-foreground">{qu.customer_phone}</p>}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{qu.items.length} item(s)</td>
                  <td className="p-3 text-right font-black">{BRL(qu.total)}</td>
                  <td className="p-3"><Badge className={statusColor(qu.status)}>{qu.status}</Badge></td>
                  <td className="p-3 text-xs text-muted-foreground">{qu.expires_at ? new Date(qu.expires_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => print(qu)} title="Imprimir / ver"><Printer className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => sendWhatsApp(qu)} title="Enviar WhatsApp"><Send className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => convertToSale(qu)} title="Converter em venda"><ShoppingCart className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(qu.id)} title="Excluir"><X className="h-3.5 w-3.5 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo orçamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cliente *</Label><Input value={form.customer_name ?? ""} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} autoFocus /></div>
              <div><Label>Telefone</Label><Input value={form.customer_phone ?? ""} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder="(11) 99999-9999" /></div>
            </div>

            <div className="border-t pt-3">
              <Label>Adicionar item</Label>
              <div className="grid grid-cols-[1fr_80px_120px_auto] gap-2 mt-1">
                <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="Produto / serviço" />
                <Input type="number" min={1} value={newItem.qty || ""} onChange={(e) => setNewItem({ ...newItem, qty: parseInt(e.target.value) || 0 })} placeholder="Qtd" />
                <Input type="number" step="0.01" value={newItem.price || ""} onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })} placeholder="R$" />
                <Button type="button" onClick={addItem} disabled={!newItem.name.trim()}>+</Button>
              </div>
            </div>

            {draftItems.length > 0 && (
              <ul className="space-y-1 max-h-48 overflow-y-auto p-2 rounded-lg bg-muted/30">
                {draftItems.map((it, i) => (
                  <li key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded">
                    <span>{it.qty}x {it.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-bold">{BRL(it.qty * it.price)}</span>
                      <button onClick={() => removeItem(i)} className="text-destructive"><X className="h-3 w-3" /></button>
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between text-sm py-2 px-2 border-t mt-1 font-black">
                  <span>TOTAL</span>
                  <span>{BRL(subtotal)}</span>
                </li>
              </ul>
            )}

            <div><Label>Observações</Label><Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Garantia, condições, etc" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.customer_name?.trim() || draftItems.length === 0}>{saving ? "Salvando..." : `Criar (${BRL(subtotal)})`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
