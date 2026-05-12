import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bike, Search, MapPin, Phone, Plus, X, CheckCircle2, Truck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/EmptyState";

type Delivery = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  address: string;
  driver_name: string | null;
  driver_phone: string | null;
  status: "aguardando" | "rota" | "entregue" | "cancelado";
  fee: number;
  notes: string | null;
  scheduled_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DeliveryManager() {
  const { orgId, userId } = useOrg();
  const [items, setItems] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Delivery | null>(null);
  const [form, setForm] = useState<Partial<Delivery>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) { setLoading(false); return; }
    const { data } = await (supabase as any).from("deliveries").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100);
    setItems((data ?? []) as Delivery[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [orgId]);

  const openNew = () => { setEditing(null); setForm({ status: "aguardando", fee: 0 }); setOpen(true); };
  const openEdit = (d: Delivery) => { setEditing(d); setForm(d); setOpen(true); };

  const save = async () => {
    if (!form.customer_name?.trim() || !form.address?.trim() || !orgId || !userId) return toast.error("Cliente e endereço obrigatórios");
    setSaving(true);
    const payload = { ...form, organization_id: orgId, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = editing
      ? await (supabase as any).from("deliveries").update(payload).eq("id", editing.id)
      : await (supabase as any).from("deliveries").insert(payload);
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success(editing ? "Atualizado" : "Entrega criada");
    setOpen(false);
    load();
  };

  const changeStatus = async (d: Delivery, status: Delivery["status"]) => {
    const upd: any = { status, updated_at: new Date().toISOString() };
    if (status === "entregue") upd.delivered_at = new Date().toISOString();
    const { error } = await (supabase as any).from("deliveries").update(upd).eq("id", d.id);
    if (error) return toast.error("Erro");
    toast.success(`Marcado: ${status}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta entrega?")) return;
    await (supabase as any).from("deliveries").delete().eq("id", id);
    load();
  };

  const filtered = items.filter((d) =>
    !q ? true : (d.customer_name + d.address + (d.driver_name ?? "")).toLowerCase().includes(q.toLowerCase())
  );

  const counters = {
    aguardando: items.filter((i) => i.status === "aguardando").length,
    rota: items.filter((i) => i.status === "rota").length,
    entregue: items.filter((i) => i.status === "entregue").length,
  };

  const statusColor = (s: string) => {
    if (s === "aguardando") return "bg-warning/10 text-warning border-warning/30";
    if (s === "rota") return "bg-info/10 text-info border-info/30";
    if (s === "entregue") return "bg-success/10 text-success border-success/30";
    return "bg-destructive/10 text-destructive border-destructive/30";
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-warning/10 grid place-items-center"><Bike className="h-5 w-5 text-warning" /></div>
          <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Aguardando</p><p className="text-2xl font-black">{counters.aguardando}</p></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-info/10 grid place-items-center"><Truck className="h-5 w-5 text-info" /></div>
          <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Em rota</p><p className="text-2xl font-black">{counters.rota}</p></div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-success/10 grid place-items-center"><CheckCircle2 className="h-5 w-5 text-success" /></div>
          <div><p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Entregue</p><p className="text-2xl font-black">{counters.entregue}</p></div>
        </Card>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente, endereço, motoboy..." className="pl-10 h-10" />
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Nova entrega</Button>
      </div>

      {loading ? (
        <Card className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Bike}
            title="Nenhuma entrega"
            description="Cadastre entregas com endereço, motoboy e taxa. Mude o status conforme a entrega progride."
            action={{ label: "Nova entrega", onClick: openNew }}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Cliente</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Endereço</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Motoboy</th>
                <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">Taxa</th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">Status</th>
                <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b hover:bg-muted/20">
                  <td className="p-3">
                    <p className="font-bold">{d.customer_name}</p>
                    {d.customer_phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {d.customer_phone}</p>}
                  </td>
                  <td className="p-3 text-xs flex items-start gap-1"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /><span>{d.address}</span></td>
                  <td className="p-3 text-xs">{d.driver_name ?? "—"}</td>
                  <td className="p-3 text-right">{BRL(d.fee ?? 0)}</td>
                  <td className="p-3">
                    <select
                      value={d.status}
                      onChange={(e) => changeStatus(d, e.target.value as Delivery["status"])}
                      className={`text-[11px] font-bold uppercase px-2 py-1 rounded-full border ${statusColor(d.status)} cursor-pointer bg-transparent`}
                    >
                      <option value="aguardando">Aguardando</option>
                      <option value="rota">Em rota</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(d.id)}><X className="h-3.5 w-3.5 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar entrega" : "Nova entrega"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Cliente *</Label><Input value={form.customer_name ?? ""} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} autoFocus /></div>
            <div><Label>Telefone do cliente</Label><Input value={form.customer_phone ?? ""} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} /></div>
            <div><Label>Taxa de entrega</Label><Input type="number" step="0.01" value={form.fee ?? 0} onChange={(e) => setForm({ ...form, fee: parseFloat(e.target.value) || 0 })} /></div>
            <div className="col-span-2"><Label>Endereço *</Label><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade" /></div>
            <div><Label>Motoboy</Label><Input value={form.driver_name ?? ""} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} /></div>
            <div><Label>Telefone motoboy</Label><Input value={form.driver_phone ?? ""} onChange={(e) => setForm({ ...form, driver_phone: e.target.value })} /></div>
            <div className="col-span-2"><Label>Observações</Label><Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
