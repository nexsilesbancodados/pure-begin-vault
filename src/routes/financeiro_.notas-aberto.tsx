import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, FileText, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { ProductForm } from "@/components/estoque/ProductForm";

export const Route = createFileRoute("/financeiro_/notas-aberto")({
  head: () => ({
    meta: [
      { title: "Notas em Aberto" },
      { name: "description", content: "Cadastre e gerencie notas em aberto." },
    ],
  }),
  component: NotasAbertoPage,
});

interface Product {
  id: string;
  name: string;
  organization_id?: string | null;
  sku?: string | null;
  imei?: string | null;
  price?: number | null;
  cost_price?: number | null;
  stock_quantity?: number | null;
  metadata?: unknown;
  [key: string]: unknown;
}

const getImeiFromMetadata = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object") return null;
  const value =
    (metadata as Record<string, unknown>).imei ?? (metadata as Record<string, unknown>).imei2;
  return value ? String(value) : null;
};

interface Nota {
  id: number;
  items: Product[];
  total: number;
  createdAt: Date;
  fornecedor: string;
  dataCompra: string;
  paga: boolean;
  prazoPagamento: string;
}

function NotasAbertoPage() {
  const { orgId, userId } = useOrg();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notas, setNotas] = useState<Nota[]>([]);
  const [addingToNotaId, setAddingToNotaId] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const detailNota = notas.find((n) => n.id === detailId) ?? null;

  const updateNota = (id: number, patch: Partial<Nota>) => {
    setNotas((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const handleSaveProduct = async (data: any) => {
    if (!editingProduct) return;
    const {
      stock, imei, imei2, color, capacity, processor, ram, display,
      margin, markup, battery_health, observations, store, ...productFields
    } = data;
    const payload: any = {
      ...productFields,
      price: parseFloat(data.price) || 0,
      cost_price: parseFloat(data.cost_price) || 0,
      stock_quantity: parseInt(stock ?? data.stock_quantity) || 0,
    };
    const { data: updated, error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", editingProduct.id)
      .select("*")
      .single();
    if (error) {
      toast.error("Erro ao salvar produto: " + error.message);
      return;
    }
    const merged: Product = { ...(updated as any), imei: getImeiFromMetadata((updated as any)?.metadata) };
    setProducts((prev) => prev.map((p) => (p.id === merged.id ? merged : p)));
    setNotas((prev) =>
      prev.map((n) => {
        if (!n.items.some((i) => i.id === merged.id)) return n;
        const items = n.items.map((i) => (i.id === merged.id ? merged : i));
        const total = items.reduce((sum, p) => sum + Number(p.price ?? 0), 0);
        return { ...n, items, total };
      }),
    );
    setEditingProduct(null);
    toast.success("Produto atualizado.");
  };

  const loadProducts = async () => {
    if (!userId) return;
    setLoading(true);

    let query = supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("name")
      .limit(500);

    if (orgId) query = query.eq("organization_id", orgId);

    let { data, error } = await query;

    if (!error && orgId && (data ?? []).length === 0) {
      const { data: memberships } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", userId);
      const orgIds = (memberships ?? [])
        .map((item) => item.organization_id)
        .filter((id): id is string => Boolean(id));

      if (orgIds.length > 0) {
        const fallback = await supabase
          .from("products")
          .select("*")
          .in("organization_id", orgIds)
          .eq("active", true)
          .order("name")
          .limit(500);
        data = fallback.data;
        error = fallback.error;
      }
    }

    if (error) toast.error("Erro ao carregar produtos: " + error.message);
    const mapped: Product[] = ((data ?? []) as Product[]).map((p) => ({
      ...p,
      imei: getImeiFromMetadata(p.metadata),
    }));
    setProducts(mapped);
    setLoading(false);
  };

  useEffect(() => {
    if (open) loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgId]);

  const filtered = products.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(s) ||
      p.sku?.toLowerCase().includes(s) ||
      p.imei?.toLowerCase().includes(s)
    );
  });

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const confirm = () => {
    const items = products.filter((p) => selected[p.id]);
    if (items.length === 0) return;

    if (addingToNotaId != null) {
      const nota = notas.find((n) => n.id === addingToNotaId);
      if (nota) {
        const existing = new Set(nota.items.map((i) => i.id));
        const merged = [...nota.items, ...items.filter((i) => !existing.has(i.id))];
        const total = merged.reduce((sum, p) => sum + Number(p.price ?? 0), 0);
        updateNota(addingToNotaId, { items: merged, total });
        toast.success(`Produto(s) adicionado(s) à Nota ${addingToNotaId}.`);
      }
      setAddingToNotaId(null);
    } else {
      const total = items.reduce((sum, p) => sum + Number(p.price ?? 0), 0);
      const newId = notas.length + 1;
      setNotas((prev) => [
        ...prev,
        {
          id: newId,
          items,
          total,
          createdAt: new Date(),
          fornecedor: "",
          dataCompra: new Date().toISOString().slice(0, 10),
          paga: false,
          prazoPagamento: "",
        },
      ]);
      toast.success(`Nota ${newId} criada com ${items.length} produto(s).`);
    }

    setSelected({});
    setOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <Topbar title="Notas em Aberto" />
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Notas em Aberto</h1>
              <p className="text-sm text-muted-foreground">
                Cadastre suas notas e acompanhe os produtos vinculados.
              </p>
            </div>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Nota
            </Button>
          </div>

          {notas.length === 0 ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center text-muted-foreground border-dashed">
              <FileText className="h-10 w-10 mb-3 opacity-60" />
              <p className="text-sm">Nenhuma nota cadastrada ainda.</p>
              <p className="text-xs">Clique em "Cadastrar Nota" para começar.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {notas.map((n) => (
                <Card
                  key={n.id}
                  className="p-4 space-y-3 cursor-pointer hover:border-primary/50 transition"
                  onClick={() => setDetailId(n.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold">Nota {n.id}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {n.createdAt.toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {n.items.length} produto(s)
                  </div>
                  <ul className="text-sm space-y-1 max-h-32 overflow-auto">
                    {n.items.map((p) => (
                      <li key={p.id} className="truncate">• {p.name}</li>
                    ))}
                  </ul>
                  <div className="pt-2 border-t flex justify-between text-sm font-medium">
                    <span>Total</span>
                    <span>R$ {n.total.toFixed(2)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Cadastrar Nota</DialogTitle>
            <DialogDescription>
              Selecione os produtos cadastrados para vincular à nota.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, SKU ou IMEI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-auto border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando produtos...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Nenhum produto encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => setSelected((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={!!selected[p.id]}
                          onChange={() => setSelected((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell
                        className="font-medium text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProduct(p);
                        }}
                      >
                        {p.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.imei ?? "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {p.cost_price != null ? `R$ ${Number(p.cost_price).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.price != null ? `R$ ${Number(p.price).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">{p.stock_quantity ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {selectedCount} produto(s) selecionado(s)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirm} disabled={selectedCount === 0}>
                Adicionar à Nota
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailId != null} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0">
          {detailNota && (
            <div className="flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b flex items-center gap-3">
                <DialogTitle className="text-xl font-bold">Nota {detailNota.id}</DialogTitle>
                <span
                  className={
                    "px-2.5 py-0.5 rounded-full text-xs font-semibold border " +
                    (detailNota.paga
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900"
                      : "bg-primary/10 text-primary border-primary/20")
                  }
                >
                  {detailNota.paga ? "Paga" : "Em aberto"}
                </span>
              </div>

              {/* Content (scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Informações da nota */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Informações da nota
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fornecedor" className="text-sm font-medium">
                        Fornecedor
                      </Label>
                      <Input
                        id="fornecedor"
                        placeholder="Nome do fornecedor"
                        value={detailNota.fornecedor}
                        onChange={(e) =>
                          updateNota(detailNota.id, { fornecedor: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dataCompra" className="text-sm font-medium">
                        Data da compra
                      </Label>
                      <Input
                        id="dataCompra"
                        type="date"
                        value={detailNota.dataCompra}
                        onChange={(e) =>
                          updateNota(detailNota.id, { dataCompra: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </section>

                {/* Pagamento */}
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Pagamento
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor="prazo" className="text-sm font-medium">
                        Prazo para pagamento
                      </Label>
                      <Input
                        id="prazo"
                        type="date"
                        value={detailNota.prazoPagamento}
                        onChange={(e) =>
                          updateNota(detailNota.id, { prazoPagamento: e.target.value })
                        }
                        disabled={detailNota.paga}
                      />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 border bg-muted/40 rounded-md h-10">
                      <span className="text-sm font-medium">Status do pagamento</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium italic">
                          {detailNota.paga ? "Paga" : "Em aberto"}
                        </span>
                        <Switch
                          id="paga"
                          checked={detailNota.paga}
                          onCheckedChange={(v) => updateNota(detailNota.id, { paga: v })}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Produtos */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Produtos ({detailNota.items.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingToNotaId(detailNota.id);
                        setDetailId(null);
                        setOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} />
                      Adicionar produto
                    </button>
                  </div>

                  <div className="border rounded-xl overflow-hidden">
                    <div className="max-h-64 overflow-auto">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-semibold">Produto</TableHead>
                            <TableHead className="font-semibold">IMEI</TableHead>
                            <TableHead className="font-semibold text-right">Custo</TableHead>
                            <TableHead className="font-semibold text-right">Venda</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailNota.items.map((p) => (
                            <TableRow key={p.id} className="hover:bg-muted/30">
                              <TableCell
                                className="font-medium text-primary cursor-pointer hover:underline"
                                onClick={() => setEditingProduct(p)}
                              >
                                {p.name}
                              </TableCell>
                              <TableCell className="text-muted-foreground font-mono text-xs">
                                {p.imei ?? "—"}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {p.cost_price != null ? `R$ ${Number(p.cost_price).toFixed(2)}` : "—"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {p.price != null ? `R$ ${Number(p.price).toFixed(2)}` : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="mt-4 flex justify-between items-center bg-slate-900 dark:bg-slate-800 rounded-xl px-6 py-4 text-white">
                    <span className="text-sm font-medium text-slate-400">Total da nota</span>
                    <span className="text-2xl font-bold tracking-tight">
                      R$ {detailNota.total.toFixed(2)}
                    </span>
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-muted/40 border-t flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setDetailId(null)}>
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    toast.success(`Nota ${detailNota.id} salva.`);
                    setDetailId(null);
                  }}
                  className="shadow-md shadow-primary/20"
                >
                  Salvar Nota
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ProductForm
        open={!!editingProduct}
        onOpenChange={(o) => !o && setEditingProduct(null)}
        product={editingProduct}
        onSave={handleSaveProduct}
      />
    </div>
  );
}
