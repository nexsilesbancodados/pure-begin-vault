import { useEffect, useRef, useState } from "react";
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
import {
  Plus, FileText, Search, Loader2, Trash2, AlertTriangle,
  CheckCircle2, Clock, Wallet, Package, Building2, Calendar,
} from "lucide-react";
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
  const [listSearch, setListSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "overdue" | "paid">("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const storageKey = `notas_abertas_${orgId ?? "default"}`;
  const [notas, setNotas] = useState<Nota[]>([]);
  const loadedRef = useRef(false);

  // Carregar notas salvas — procura na chave atual e em chaves legadas
  useEffect(() => {
    loadedRef.current = false;
    try {
      const candidates = [storageKey, "notas_abertas_default"];
      // varre todas as chaves notas_abertas_* (caso a nota tenha sido salva sob outra loja)
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("notas_abertas_") && !candidates.includes(k)) candidates.push(k);
      }
      let parsed: Nota[] = [];
      for (const key of candidates) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const arr = JSON.parse(raw) as Nota[];
          if (Array.isArray(arr) && arr.length > 0) {
            parsed = arr;
            break;
          }
        } catch {
          /* ignore */
        }
      }
      setNotas(parsed.map((n) => ({ ...n, createdAt: new Date(n.createdAt) })));
    } catch {
      setNotas([]);
    } finally {
      // libera o persist na próxima renderização
      requestAnimationFrame(() => {
        loadedRef.current = true;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Persistir somente após o load inicial (evita sobrescrever com [])
  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notas));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notas, orgId]);
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
    const isNew = !editingProduct.id;
    if (isNew) {
      if (orgId) payload.organization_id = orgId;
      payload.active = true;
    }
    const query = isNew
      ? supabase.from("products").insert(payload).select("*").single()
      : supabase.from("products").update(payload).eq("id", editingProduct.id).select("*").single();
    const { data: saved, error } = await query;
    if (error) {
      toast.error("Erro ao salvar produto: " + error.message);
      return;
    }
    const merged: Product = { ...(saved as any), imei: getImeiFromMetadata((saved as any)?.metadata) };
    setProducts((prev) =>
      isNew ? [merged, ...prev] : prev.map((p) => (p.id === merged.id ? merged : p)),
    );
    if (isNew) toast.success("Produto cadastrado!");
    setNotas((prev) =>
      prev.map((n) => {
        if (!n.items.some((i) => i.id === merged.id)) return n;
        const items = n.items.map((i) => (i.id === merged.id ? merged : i));
        const total = items.reduce((sum, p) => sum + Number(p.cost_price ?? p.price ?? 0), 0);
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
        const total = merged.reduce((sum, p) => sum + Number(p.cost_price ?? p.price ?? 0), 0);
        updateNota(addingToNotaId, { items: merged, total });
        toast.success(`Produto(s) adicionado(s) à Nota ${addingToNotaId}.`);
      }
      setAddingToNotaId(null);
    } else {
      const total = items.reduce((sum, p) => sum + Number(p.cost_price ?? p.price ?? 0), 0);
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
          {/* Hero */}
          <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  <FileText className="h-3.5 w-3.5" />
                  Notas de Compra
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Notas em Aberto</h1>
                <p className="text-sm text-muted-foreground max-w-xl">
                  Cadastre notas de fornecedores, vincule produtos e acompanhe vencimentos de pagamento.
                </p>
              </div>
              <Button onClick={() => setOpen(true)} size="lg" className="gap-2 shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4" />
                Cadastrar Nota
              </Button>
            </div>
          </div>

          {/* KPIs */}
          {notas.length > 0 && (() => {
            const totalNotas = notas.length;
            const emAberto = notas.filter((n) => !n.paga);
            const pagas = notas.filter((n) => n.paga);
            const valorAberto = emAberto.reduce((s, n) => s + n.total, 0);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const vencidas = emAberto.filter((n) => {
              if (!n.prazoPagamento) return false;
              return new Date(n.prazoPagamento) < today;
            });
            const valorVencido = vencidas.reduce((s, n) => s + n.total, 0);
            const kpis = [
              { icon: FileText, label: "Total de notas", value: totalNotas.toString(), tone: "primary" },
              { icon: Clock, label: "Em aberto", value: emAberto.length.toString(), sub: `R$ ${valorAberto.toFixed(2)}`, tone: "warn" },
              { icon: AlertTriangle, label: "Vencidas", value: vencidas.length.toString(), sub: `R$ ${valorVencido.toFixed(2)}`, tone: "danger" },
              { icon: CheckCircle2, label: "Pagas", value: pagas.length.toString(), tone: "ok" },
            ];
            const toneClass = (t: string) =>
              t === "warn" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
              : t === "danger" ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
              : t === "ok" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
              : "bg-primary/10 text-primary";
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {kpis.map((k) => (
                  <Card key={k.label} className="p-4 flex items-center gap-3 hover:shadow-md transition">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${toneClass(k.tone)}`}>
                      <k.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground truncate">{k.label}</div>
                      <div className="text-xl font-bold leading-tight">{k.value}</div>
                      {k.sub && <div className="text-[11px] text-muted-foreground truncate">{k.sub}</div>}
                    </div>
                  </Card>
                ))}
              </div>
            );
          })()}

          {/* Filters */}
          {notas.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por fornecedor ou número da nota..."
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1 p-1 bg-muted rounded-md">
                {(["all", "open", "overdue", "paid"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                      statusFilter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? "Todas" : f === "open" ? "Em aberto" : f === "overdue" ? "Vencidas" : "Pagas"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista */}
          {notas.length === 0 ? (
            <Card className="p-16 flex flex-col items-center justify-center text-center border-dashed">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Nenhuma nota cadastrada</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Comece cadastrando uma nota e vinculando os produtos comprados do fornecedor.
              </p>
              <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Cadastrar primeira nota
              </Button>
            </Card>
          ) : (() => {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const visible = notas.filter((n) => {
              const isOverdue = !n.paga && n.prazoPagamento && new Date(n.prazoPagamento) < today;
              if (statusFilter === "open" && n.paga) return false;
              if (statusFilter === "paid" && !n.paga) return false;
              if (statusFilter === "overdue" && !isOverdue) return false;
              if (listSearch) {
                const s = listSearch.toLowerCase();
                if (!n.fornecedor.toLowerCase().includes(s) && !`nota ${n.id}`.includes(s)) return false;
              }
              return true;
            });
            if (visible.length === 0) {
              return (
                <Card className="p-12 text-center text-sm text-muted-foreground border-dashed">
                  Nenhuma nota corresponde aos filtros aplicados.
                </Card>
              );
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map((n) => {
                  const isOverdue = !n.paga && n.prazoPagamento && new Date(n.prazoPagamento) < today;
                  const daysToDue = n.prazoPagamento
                    ? Math.ceil((new Date(n.prazoPagamento).getTime() - today.getTime()) / 86400000)
                    : null;
                  return (
                    <Card
                      key={n.id}
                      className="group relative p-0 overflow-hidden cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all"
                      onClick={() => setDetailId(n.id)}
                    >
                      {/* Status stripe */}
                      <div className={`h-1 w-full ${
                        n.paga ? "bg-emerald-500"
                        : isOverdue ? "bg-rose-500"
                        : "bg-primary"
                      }`} />

                      <div className="p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-semibold truncate">Nota {n.id}</h3>
                              <p className="text-[11px] text-muted-foreground">
                                {n.createdAt.toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              n.paga
                                ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900"
                                : isOverdue
                                ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/40 dark:border-rose-900"
                                : "bg-primary/10 text-primary border-primary/20"
                            }`}>
                              {n.paga ? "Paga" : isOverdue ? "Vencida" : "Em aberto"}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Excluir Nota ${n.id}?`)) {
                                  setNotas((prev) => prev.filter((x) => x.id !== n.id));
                                  toast.success(`Nota ${n.id} excluída.`);
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 transition h-7 w-7 rounded-md hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 flex items-center justify-center text-muted-foreground"
                              aria-label="Excluir nota"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Metadata */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{n.fornecedor || "Fornecedor não informado"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Package className="h-3.5 w-3.5 shrink-0" />
                            <span>{n.items.length} produto(s)</span>
                          </div>
                          {n.prazoPagamento && !n.paga && (
                            <div className={`flex items-center gap-1.5 ${
                              isOverdue ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground"
                            }`}>
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {isOverdue
                                  ? `Vencida há ${Math.abs(daysToDue ?? 0)}d`
                                  : daysToDue === 0
                                  ? "Vence hoje"
                                  : `Vence em ${daysToDue}d`}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Total */}
                        <div className="pt-3 border-t flex items-end justify-between">
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Total</span>
                          <span className="text-lg font-bold tracking-tight">
                            R$ {n.total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
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

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, SKU ou IMEI..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setEditingProduct({} as any)}
              className="shrink-0 gap-1"
            >
              <Plus className="h-4 w-4" /> Cadastrar Produto
            </Button>
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
