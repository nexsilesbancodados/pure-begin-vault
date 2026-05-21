import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  ShoppingCart,
  ClipboardList,
  Building2,
  Trophy,
  CheckCircle2,
  Clock,
  FileText,
  Percent,
  Sparkles,
  Copy,
  TrendingUp,
  ClipboardPaste,
  Wand2,
} from "lucide-react";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/compras")({
  head: () => ({
    meta: [
      { title: "Cotações de Compra" },
      { name: "description", content: "Crie cotações de compra e compare fornecedores." },
    ],
  }),
  component: ComprasPage,
});

type QuotationStatus = "aberta" | "fechada" | "cancelada";

export interface PriceBreakdown {
  cost: number;
  frete1: number;
  frete2: number;
}

interface QuotationItem {
  id: string;
  name: string;
  quantity: number;
  salePrice?: number;
  notes?: string;
}

interface SupplierQuote {
  id: string;
  supplier: string;
  // chave: itemId -> número (legado) ou breakdown {cost, frete1, frete2}
  prices: Record<string, number | PriceBreakdown | null>;
  notes?: string;
  leadTimeDays?: number;
}

interface Quotation {
  id: string;
  title: string;
  status: QuotationStatus;
  createdAt: string;
  items: QuotationItem[];
  suppliers: SupplierQuote[];
  winnerSupplierId?: string | null;
  notes?: string;
}

const emptyBreakdown = (): PriceBreakdown => ({ cost: 0, frete1: 0, frete2: 0 });

const unitTotal = (p: number | PriceBreakdown | null | undefined): number => {
  if (p == null) return 0;
  if (typeof p === "number") return p;
  return (Number(p.cost) || 0) + (Number(p.frete1) || 0) + (Number(p.frete2) || 0);
};

const asBreakdown = (p: number | PriceBreakdown | null | undefined): PriceBreakdown => {
  if (p == null) return emptyBreakdown();
  if (typeof p === "number") return { cost: p, frete1: 0, frete2: 0 };
  return { cost: p.cost || 0, frete1: p.frete1 || 0, frete2: p.frete2 || 0 };
};


const storageKey = (orgId: string) => `purchase_quotations_${orgId}`;

const readAll = (orgId: string): Quotation[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey(orgId)) || "[]");
  } catch {
    return [];
  }
};

const writeAll = (orgId: string, list: Quotation[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(orgId), JSON.stringify(list));
};

const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`);

function ComprasPage() {
  const { orgId } = useOrg();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [list, setList] = useState<Quotation[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    setList(readAll(orgId));
  }, [orgId]);

  const persist = (next: Quotation[]) => {
    setList(next);
    if (orgId) writeAll(orgId, next);
  };

  const detail = list.find((q) => q.id === detailId) ?? null;

  const stats = useMemo(() => {
    return {
      total: list.length,
      open: list.filter((q) => q.status === "aberta").length,
      closed: list.filter((q) => q.status === "fechada").length,
    };
  }, [list]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title="Cotações de Compra"
          subtitle="Compare preços de fornecedores antes de comprar"
          toggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Header */}
          <Card className="p-6 bg-gradient-to-br from-primary/10 via-card to-card border-primary/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                  <ShoppingCart className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-black">Cotações de Compra</h1>
                  <p className="text-sm text-muted-foreground">
                    Solicite preços a múltiplos fornecedores e escolha a melhor proposta.
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => setOpenNew(true)}
              >
                <Plus className="h-4 w-4" /> Nova Cotação
              </Button>
            </div>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiTile label="Total" value={stats.total} icon={<ClipboardList className="h-4 w-4" />} />
            <KpiTile
              label="Em aberto"
              value={stats.open}
              icon={<Clock className="h-4 w-4" />}
              tone="amber"
            />
            <KpiTile
              label="Fechadas"
              value={stats.closed}
              icon={<CheckCircle2 className="h-4 w-4" />}
              tone="emerald"
            />
          </div>

          {/* List */}
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Minhas cotações
              </h2>
              <span className="text-xs text-muted-foreground">{list.length} registro(s)</span>
            </div>
            {list.length === 0 ? (
              <div className="p-12 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="font-bold">Nenhuma cotação ainda</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Comece criando sua primeira cotação para comparar fornecedores.
                </p>
                <Button className="mt-4 gap-2" onClick={() => setOpenNew(true)}>
                  <Plus className="h-4 w-4" /> Nova Cotação
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {list
                  .slice()
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((q) => {
                    const best = computeBestSupplier(q);
                    return (
                      <button
                        key={q.id}
                        onClick={() => setDetailId(q.id)}
                        className="w-full text-left px-5 py-4 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold truncate">{q.title}</h3>
                            <StatusBadge status={q.status} />
                            {q.winnerSupplierId && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300">
                                <Trophy className="h-3 w-3 mr-1" />
                                Vencedor escolhido
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {q.items.length} item(ns) · {q.suppliers.length} fornecedor(es) ·
                            {" "}criada em {new Date(q.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        {best && (
                          <div className="text-right shrink-0">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Melhor proposta
                            </div>
                            <div className="text-sm font-bold text-emerald-600">
                              {best.supplier} · R$ {best.total.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            )}
          </Card>
        </main>
      </div>

      {openNew && (
        <NewQuotationModal
          onClose={() => setOpenNew(false)}
          onCreate={(q) => {
            const next = [q, ...list];
            persist(next);
            setOpenNew(false);
            setDetailId(q.id);
          }}
        />
      )}

      {detail && (
        <QuotationDetailModal
          quotation={detail}
          onClose={() => setDetailId(null)}
          onUpdate={(updated) =>
            persist(list.map((q) => (q.id === updated.id ? updated : q)))
          }
          onDelete={(id) => {
            persist(list.filter((q) => q.id !== id));
            setDetailId(null);
            toast.success("Cotação removida");
          }}
        />
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "default" | "amber" | "emerald";
}) {
  const colors =
    tone === "amber"
      ? "from-amber-50 to-white text-amber-700 border-amber-200 dark:from-amber-950/40 dark:to-transparent dark:text-amber-300 dark:border-amber-900"
      : tone === "emerald"
        ? "from-emerald-50 to-white text-emerald-700 border-emerald-200 dark:from-emerald-950/40 dark:to-transparent dark:text-emerald-300 dark:border-emerald-900"
        : "from-muted/40 to-card text-foreground border-border";
  return (
    <Card className={`p-4 bg-gradient-to-br ${colors}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</div>
        {icon}
      </div>
      <div className="text-3xl font-black mt-1">{value}</div>
    </Card>
  );
}

function StatusBadge({ status }: { status: QuotationStatus }) {
  if (status === "aberta")
    return (
      <Badge className="bg-amber-500/15 text-amber-700 border-amber-300">
        <Clock className="h-3 w-3 mr-1" />
        Aberta
      </Badge>
    );
  if (status === "fechada")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Fechada
      </Badge>
    );
  return <Badge variant="outline">Cancelada</Badge>;
}

function computeSupplierTotal(q: Quotation, s: SupplierQuote) {
  return q.items.reduce((sum, it) => {
    const unit = unitTotal(s.prices[it.id]);
    return sum + unit * (Number(it.quantity) || 0);
  }, 0);
}

function computeSupplierRevenue(q: Quotation) {
  return q.items.reduce(
    (sum, it) => sum + (Number(it.salePrice) || 0) * (Number(it.quantity) || 0),
    0,
  );
}

function computeBestSupplier(q: Quotation) {
  if (q.suppliers.length === 0 || q.items.length === 0) return null;
  let best: { supplier: string; total: number; id: string } | null = null;
  for (const s of q.suppliers) {
    const total = computeSupplierTotal(q, s);
    if (total <= 0) continue;
    if (!best || total < best.total) {
      best = { supplier: s.supplier, total, id: s.id };
    }
  }
  return best;
}

// ===== Helpers de importação (parser de listas coladas) =====
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseLine = (raw: string): { name: string; value: number } | null => {
  const line = raw.trim();
  if (!line) return null;
  const matches = Array.from(line.matchAll(/(\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/g));
  if (matches.length === 0) return { name: line, value: 0 };
  const last = matches[matches.length - 1];
  const raw2 = last[0];
  let num: number;
  if (raw2.includes(",")) num = Number(raw2.replace(/\./g, "").replace(",", "."));
  else if (/\d{1,3}(\.\d{3})+$/.test(raw2)) num = Number(raw2.replace(/\./g, ""));
  else num = Number(raw2);
  const idx = last.index ?? 0;
  const name = (line.slice(0, idx) + line.slice(idx + raw2.length))
    .replace(/[-–—|:R\$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { name: name || line, value: Number.isFinite(num) ? num : 0 };
};




function NewQuotationModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (q: Quotation) => void;
}) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<QuotationItem[]>([
    { id: newId(), name: "", quantity: 1, salePrice: 0 },
  ]);
  // 3 fornecedores fixos por padrão
  const [supplierNames, setSupplierNames] = useState<string[]>([
    "Fornecedor 1",
    "Fornecedor 2",
    "Fornecedor 3",
  ]);
  // breakdown[itemId][supplierIdx] = {cost, frete1, frete2}
  const [breakdown, setBreakdown] = useState<Record<string, PriceBreakdown[]>>(() => ({
    [items[0].id]: [emptyBreakdown(), emptyBreakdown(), emptyBreakdown()],
  }));
  const [notes, setNotes] = useState("");
  const [markup, setMarkup] = useState<number>(30); // % padrão sugerido
  const [importOpen, setImportOpen] = useState(false);
  const [importProducts, setImportProducts] = useState("");
  const [importSup, setImportSup] = useState<string[]>(["", "", ""]);

  const applyImport = () => {
    // 1) Parse lista de produtos -> nome + qtd (último número = qtd, default 1)
    const prodLines = importProducts
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (prodLines.length === 0) {
      toast.error("Cole a lista de produtos");
      return;
    }
    const parsedProducts = prodLines
      .map((l) => {
        const p = parseLine(l);
        if (!p) return null;
        const qty = p.value > 0 && p.value < 10000 ? Math.round(p.value) : 1;
        return { name: p.name, qty };
      })
      .filter(Boolean) as { name: string; qty: number }[];

    // 2) Parse cada lista de fornecedor -> map normalizado nome->preço + array em ordem
    const supParsed = importSup.map((txt) => {
      const lines = txt
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const arr = lines.map((l) => parseLine(l)).filter(Boolean) as {
        name: string;
        value: number;
      }[];
      const map = new Map<string, number>();
      arr.forEach((it) => {
        if (it.name) map.set(normalize(it.name), it.value);
      });
      return { arr, map };
    });

    // 3) Constrói items e breakdown casando por nome; fallback por ordem
    const newItems: QuotationItem[] = [];
    const newBreakdown: Record<string, PriceBreakdown[]> = {};
    parsedProducts.forEach((prod, idx) => {
      const id = newId();
      newItems.push({ id, name: prod.name, quantity: prod.qty, salePrice: 0 });
      const norm = normalize(prod.name);
      const costs = supParsed.map((sp) => {
        const byName = sp.map.get(norm);
        if (byName != null && byName > 0) return byName;
        // fallback: mesma posição
        const byIdx = sp.arr[idx]?.value;
        return byIdx && byIdx > 0 ? byIdx : 0;
      });
      newBreakdown[id] = costs.map((c) => ({ cost: c, frete1: 0, frete2: 0 }));
    });

    setItems(newItems);
    setBreakdown(newBreakdown);
    setImportOpen(false);
    toast.success(`${newItems.length} produto(s) importado(s) — confira os valores.`);
  };


  const addItem = () => {
    const id = newId();
    setItems((p) => [...p, { id, name: "", quantity: 1, salePrice: 0 }]);
    setBreakdown((p) => ({
      ...p,
      [id]: supplierNames.map(() => emptyBreakdown()),
    }));
  };

  const removeItem = (id: string) => {
    setItems((p) => p.filter((x) => x.id !== id));
    setBreakdown((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };

  const updateItem = (id: string, patch: Partial<QuotationItem>) => {
    setItems((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const updateBreakdown = (
    itemId: string,
    supIdx: number,
    field: keyof PriceBreakdown,
    value: string,
  ) => {
    const num = Number(value.replace(",", ".")) || 0;
    setBreakdown((p) => {
      const arr = (p[itemId] ?? supplierNames.map(() => emptyBreakdown())).slice();
      arr[supIdx] = { ...arr[supIdx], [field]: num };
      return { ...p, [itemId]: arr };
    });
  };

  const updateSupplierName = (idx: number, name: string) =>
    setSupplierNames((p) => p.map((x, i) => (i === idx ? name : x)));

  // copiar custo do fornecedor para todos os demais
  const copyCostToAll = (itemId: string, fromIdx: number) => {
    setBreakdown((p) => {
      const arr = (p[itemId] ?? supplierNames.map(() => emptyBreakdown())).slice();
      const src = arr[fromIdx] ?? emptyBreakdown();
      const next = arr.map(() => ({ ...src }));
      return { ...p, [itemId]: next };
    });
    toast.success("Custo replicado para os 3 fornecedores");
  };

  // cálculos por linha
  const computeRow = (it: QuotationItem) => {
    const sups = breakdown[it.id] ?? supplierNames.map(() => emptyBreakdown());
    const unitTotals = sups.map((b) => (b.cost || 0) + (b.frete1 || 0) + (b.frete2 || 0));
    const positives = unitTotals.filter((v) => v > 0);
    const bestUnit = positives.length ? Math.min(...positives) : 0;
    const bestIdx = bestUnit > 0 ? unitTotals.indexOf(bestUnit) : -1;
    const worstUnit = positives.length ? Math.max(...positives) : 0;
    const savings = worstUnit > 0 && bestUnit > 0 ? worstUnit - bestUnit : 0;
    const sale = Number(it.salePrice) || 0;
    const profitPerUnit = bestUnit > 0 ? sale - bestUnit : 0;
    const profitTotal = profitPerUnit * (Number(it.quantity) || 0);
    const marginPct = sale > 0 && profitPerUnit !== 0 ? (profitPerUnit / sale) * 100 : 0;
    return {
      sups,
      unitTotals,
      bestUnit,
      bestIdx,
      worstUnit,
      savings,
      profitPerUnit,
      profitTotal,
      marginPct,
    };
  };

  // aplica markup global no preço de venda baseado no melhor custo
  const applyMarkup = () => {
    const pct = Number(markup) || 0;
    setItems((prev) =>
      prev.map((it) => {
        const r = computeRow(it);
        if (r.bestUnit <= 0) return it;
        return { ...it, salePrice: Number((r.bestUnit * (1 + pct / 100)).toFixed(2)) };
      }),
    );
    toast.success(`Markup de ${pct}% aplicado em todos os itens`);
  };

  // subtotais por fornecedor (somando todos os itens)
  const supplierTotals = useMemo(() => {
    return supplierNames.map((_, idx) => {
      let total = 0;
      items.forEach((it) => {
        const bd = (breakdown[it.id] ?? [])[idx] ?? emptyBreakdown();
        const unit = (bd.cost || 0) + (bd.frete1 || 0) + (bd.frete2 || 0);
        total += unit * (Number(it.quantity) || 0);
      });
      return total;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, breakdown, supplierNames]);

  const bestSupplierIdx = useMemo(() => {
    const positives = supplierTotals.filter((v) => v > 0);
    if (!positives.length) return -1;
    const min = Math.min(...positives);
    return supplierTotals.indexOf(min);
  }, [supplierTotals]);

  const grand = useMemo(() => {
    let cost = 0;
    let revenue = 0;
    let profit = 0;
    items.forEach((it) => {
      const r = computeRow(it);
      const qty = Number(it.quantity) || 0;
      if (r.bestUnit > 0) cost += r.bestUnit * qty;
      revenue += (Number(it.salePrice) || 0) * qty;
      profit += r.profitTotal;
    });
    return { cost, revenue, profit };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, breakdown, supplierNames]);

  const submit = () => {
    if (!title.trim()) return toast.error("Informe um título");
    const validItems = items.filter((i) => i.name.trim() && i.quantity > 0);
    if (validItems.length === 0) return toast.error("Adicione ao menos 1 item");
    const validNames = supplierNames.map((n, i) => n.trim() || `Fornecedor ${i + 1}`);

    const q: Quotation = {
      id: newId(),
      title: title.trim(),
      status: "aberta",
      createdAt: new Date().toISOString(),
      items: validItems,
      notes: notes.trim() || undefined,
      suppliers: validNames.map((name, idx) => ({
        id: newId(),
        supplier: name,
        prices: Object.fromEntries(
          validItems.map((i) => [
            i.id,
            (breakdown[i.id] ?? [])[idx] ?? emptyBreakdown(),
          ]),
        ),
      })),
    };
    onCreate(q);
  };

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[1280px] w-[97vw] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Nova Cotação de Compra
          </DialogTitle>
          <DialogDescription>
            Compare 3 fornecedores lado a lado — Custo + Frete 1 + Frete 2 = Total. Informe o
            preço de venda (ou aplique um markup %) para visualizar o lucro automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-5 max-h-[72vh] overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Título da cotação</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Reposição iPhones — Junho"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {supplierNames.map((n, i) => (
                <div key={i}>
                  <Label className="text-xs flex items-center gap-1">
                    Fornecedor {i + 1}
                    {bestSupplierIdx === i && supplierTotals[i] > 0 && (
                      <Trophy className="h-3 w-3 text-amber-500" />
                    )}
                  </Label>
                  <Input
                    value={n}
                    onChange={(e) => updateSupplierName(i, e.target.value)}
                    placeholder={`Fornecedor ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Toolbar: markup global */}
          <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl border bg-gradient-to-r from-primary/5 via-card to-emerald-500/5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <Label className="text-xs">Markup global (%)</Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      step="1"
                      value={markup}
                      onChange={(e) => setMarkup(Number(e.target.value) || 0)}
                      className="h-9 w-28 pr-8 text-right"
                    />
                    <Percent className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <Button size="sm" onClick={applyMarkup} className="gap-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Aplicar em todos
                  </Button>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground max-w-xs">
              Calcula o preço de venda de cada item a partir do <b>menor custo</b> + markup.
            </div>
            <div className="ml-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="gap-1"
                title="Cole listas de produtos e preços dos 3 fornecedores"
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Importar listas
              </Button>
            </div>
          </div>


          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[55vh] divide-y divide-border">
              {items.map((it, rowIdx) => {
                const r = computeRow(it);
                const sale = Number(it.salePrice) || 0;
                return (
                  <div key={it.id} className="bg-card">
                    {/* Cabeçalho do item */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                      <span className="text-[10px] font-bold text-muted-foreground w-6 text-center">
                        #{rowIdx + 1}
                      </span>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-2">
                        <Input
                          value={it.name}
                          onChange={(e) => updateItem(it.id, { name: e.target.value })}
                          placeholder="Descrição do produto (ex.: iPhone 15 Pro Max 256)"
                          className="h-9 font-semibold"
                        />
                        <div className="flex items-center gap-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                            Qtd.
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) =>
                              updateItem(it.id, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="h-9 text-center w-20"
                          />
                        </div>
                      </div>
                      {items.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeItem(it.id)}
                          className="h-8 w-8 shrink-0"
                          title="Remover item"
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      )}
                    </div>

                    {/* Tabela transposta: linhas = labels, colunas = fornecedores */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wider font-bold text-muted-foreground w-[160px]">
                            Fornecedores:
                          </th>
                          {supplierNames.map((n, i) => {
                            const isBest = bestSupplierIdx === i && supplierTotals[i] > 0;
                            return (
                              <th
                                key={i}
                                className={
                                  "text-left px-3 py-2 border-l border-border " +
                                  (isBest ? "bg-amber-500/15" : "bg-primary/5")
                                }
                              >
                                <div className="flex items-center gap-1 font-bold text-foreground">
                                  {isBest ? (
                                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                                  ) : (
                                    <Building2 className="h-3.5 w-3.5 text-primary" />
                                  )}
                                  {n || `Fornecedor ${i + 1}`}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {/* CUSTO */}
                        <tr className="border-t border-border">
                          <td className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/10">
                            Custo
                          </td>
                          {supplierNames.map((_, i) => {
                            const bd = r.sups[i] ?? emptyBreakdown();
                            return (
                              <td key={`cost-${i}`} className="px-2 py-1 border-l border-border">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                    R$
                                  </span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={bd.cost || ""}
                                    onChange={(e) =>
                                      updateBreakdown(it.id, i, "cost", e.target.value)
                                    }
                                    placeholder="0,00"
                                    className="h-8 pl-8 pr-7 text-right tabular-nums"
                                  />
                                  {bd.cost > 0 && (
                                    <button
                                      type="button"
                                      title="Copiar custo para os outros fornecedores"
                                      onClick={() => copyCostToAll(it.id, i)}
                                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                        {/* FRETE 1 */}
                        <tr className="border-t border-border">
                          <td className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/10">
                            Frete 1
                          </td>
                          {supplierNames.map((_, i) => {
                            const bd = r.sups[i] ?? emptyBreakdown();
                            return (
                              <td key={`f1-${i}`} className="px-2 py-1 border-l border-border">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                    R$
                                  </span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={bd.frete1 || ""}
                                    onChange={(e) =>
                                      updateBreakdown(it.id, i, "frete1", e.target.value)
                                    }
                                    placeholder="0,00"
                                    className="h-8 pl-8 text-right tabular-nums"
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                        {/* FRETE 2 */}
                        <tr className="border-t border-border">
                          <td className="px-3 py-1.5 text-[11px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/10">
                            Frete 2
                          </td>
                          {supplierNames.map((_, i) => {
                            const bd = r.sups[i] ?? emptyBreakdown();
                            return (
                              <td key={`f2-${i}`} className="px-2 py-1 border-l border-border">
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                    R$
                                  </span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={bd.frete2 || ""}
                                    onChange={(e) =>
                                      updateBreakdown(it.id, i, "frete2", e.target.value)
                                    }
                                    placeholder="0,00"
                                    className="h-8 pl-8 text-right tabular-nums"
                                  />
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                        {/* TOTAL */}
                        <tr className="border-t-2 border-border bg-muted/20">
                          <td className="px-3 py-2 text-[11px] uppercase tracking-wider font-black text-foreground">
                            Total
                          </td>
                          {supplierNames.map((_, i) => {
                            const isBest = r.bestIdx === i && r.bestUnit > 0;
                            return (
                              <td
                                key={`tot-${i}`}
                                className={
                                  "px-3 py-2 text-right font-black tabular-nums border-l border-border " +
                                  (isBest
                                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-700"
                                    : "")
                                }
                              >
                                <div className="flex items-center justify-end gap-1.5">
                                  {isBest && <Trophy className="h-3 w-3 text-emerald-600" />}
                                  {r.unitTotals[i] > 0
                                    ? `R$ ${fmt(r.unitTotals[i])}`
                                    : "—"}
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                        {/* PREÇO DE VENDA — input único, mesma venda para qualquer fornecedor */}
                        <tr className="border-t border-border bg-emerald-500/5">
                          <td className="px-3 py-2 text-[11px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400">
                            Preço de Venda
                          </td>
                          <td
                            colSpan={supplierNames.length}
                            className="px-2 py-1 border-l border-border"
                          >
                            <div className="flex items-center gap-2">
                              <div className="relative max-w-[200px]">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                                  R$
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={it.salePrice || ""}
                                  onChange={(e) =>
                                    updateItem(it.id, {
                                      salePrice: Number(e.target.value) || 0,
                                    })
                                  }
                                  placeholder="0,00"
                                  className="h-8 pl-8 text-right tabular-nums font-semibold"
                                />
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                aplicado em todos os fornecedores
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* LUCRO */}
                        <tr className="border-t border-border bg-emerald-500/5">
                          <td className="px-3 py-2 text-[11px] uppercase tracking-wider font-black text-emerald-700 dark:text-emerald-400">
                            Lucro
                          </td>
                          {supplierNames.map((_, i) => {
                            const total = r.unitTotals[i];
                            const profit = total > 0 ? sale - total : 0;
                            const isBest = r.bestIdx === i && r.bestUnit > 0;
                            return (
                              <td
                                key={`lucro-${i}`}
                                className={
                                  "px-3 py-2 text-right font-black tabular-nums border-l border-border " +
                                  (isBest ? "bg-emerald-100/50 dark:bg-emerald-950/40" : "")
                                }
                              >
                                {total > 0 ? (
                                  <div className="flex flex-col items-end">
                                    <span
                                      className={
                                        profit > 0
                                          ? "text-emerald-600"
                                          : profit < 0
                                            ? "text-rose-600"
                                            : "text-muted-foreground"
                                      }
                                    >
                                      R$ {fmt(profit)}
                                    </span>
                                    {sale > 0 && profit !== 0 && (
                                      <span className="text-[10px] font-semibold text-muted-foreground">
                                        {((profit / sale) * 100).toFixed(1)}% margem
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {/* Subtotais consolidados por fornecedor (toda a cotação) */}
              <div className="bg-muted/40 border-t-2 border-border">
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 text-[11px] uppercase tracking-wider font-black text-muted-foreground w-[160px]">
                        Subtotal geral
                      </td>
                      {supplierNames.map((_, i) => {
                        const isBest = bestSupplierIdx === i && supplierTotals[i] > 0;
                        return (
                          <td
                            key={`gsub-${i}`}
                            className={
                              "px-3 py-2 text-right font-black tabular-nums border-l border-border " +
                              (isBest
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "")
                            }
                          >
                            {supplierTotals[i] > 0 ? (
                              <span className="inline-flex items-center gap-1.5">
                                {isBest && <Trophy className="h-3.5 w-3.5" />}R${" "}
                                {fmt(supplierTotals[i])}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="border-t bg-muted/30 px-3 py-2 flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "item" : "itens"} na cotação
              </div>
              <Button size="sm" variant="outline" onClick={addItem} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Adicionar item
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="p-4 bg-gradient-to-br from-muted/40 to-card">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                Custo (melhor)
              </div>
              <div className="text-2xl font-black mt-1 tabular-nums">R$ {fmt(grand.cost)}</div>
              {bestSupplierIdx >= 0 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 inline-flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> {supplierNames[bestSupplierIdx]}
                </div>
              )}
            </Card>
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-card border-primary/30">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                Receita prevista
              </div>
              <div className="text-2xl font-black mt-1 tabular-nums">R$ {fmt(grand.revenue)}</div>
            </Card>
            <Card
              className={
                "p-4 bg-gradient-to-br " +
                (grand.profit >= 0
                  ? "from-emerald-500/10 to-card border-emerald-300"
                  : "from-rose-500/10 to-card border-rose-300")
              }
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                Lucro estimado
              </div>
              <div
                className={
                  "text-2xl font-black mt-1 tabular-nums " +
                  (grand.profit >= 0 ? "text-emerald-600" : "text-rose-600")
                }
              >
                R$ {fmt(grand.profit)}
              </div>
              {grand.revenue > 0 && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  margem {((grand.profit / grand.revenue) * 100).toFixed(1)}%
                </div>
              )}
            </Card>
          </div>

          {/* Observações */}
          <div>
            <Label className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Observações da cotação
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: prazo de entrega esperado, condições de pagamento, contatos..."
              rows={2}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-3 border-t mt-2 flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="text-xs text-muted-foreground mr-auto">
            {bestSupplierIdx >= 0 ? (
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                Melhor fornecedor:{" "}
                <b className="text-foreground">{supplierNames[bestSupplierIdx]}</b> — R${" "}
                {fmt(supplierTotals[bestSupplierIdx])}
              </span>
            ) : (
              <span>Preencha os custos para identificar o melhor fornecedor.</span>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} className="gap-2">
            <Plus className="h-4 w-4" /> Criar cotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuotationDetailModal({
  quotation,
  onClose,
  onUpdate,
  onDelete,
}: {
  quotation: Quotation;
  onClose: () => void;
  onUpdate: (q: Quotation) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState<Quotation>(quotation);
  useEffect(() => setQ(quotation), [quotation]);

  const totals = q.suppliers.map((s) => ({
    id: s.id,
    name: s.supplier,
    total: computeSupplierTotal(q, s),
  }));
  const minTotal = Math.min(
    ...totals.filter((t) => t.total > 0).map((t) => t.total),
    Infinity,
  );

  const updatePrice = (supplierId: string, itemId: string, value: string) => {
    const num = value === "" ? null : Number(value);
    setQ((prev) => ({
      ...prev,
      suppliers: prev.suppliers.map((s) =>
        s.id === supplierId
          ? { ...s, prices: { ...s.prices, [itemId]: num != null && !isNaN(num) ? num : null } }
          : s,
      ),
    }));
  };

  const save = () => {
    onUpdate(q);
    toast.success("Cotação atualizada");
  };

  const pickWinner = (supplierId: string) => {
    const updated = { ...q, winnerSupplierId: supplierId, status: "fechada" as QuotationStatus };
    setQ(updated);
    onUpdate(updated);
    const supplier = q.suppliers.find((s) => s.id === supplierId);
    toast.success(`Fornecedor escolhido: ${supplier?.supplier ?? ""}`);
  };

  const addSupplier = () => {
    const name = window.prompt("Nome do fornecedor:");
    if (!name?.trim()) return;
    setQ((prev) => ({
      ...prev,
      suppliers: [
        ...prev.suppliers,
        {
          id: newId(),
          supplier: name.trim(),
          prices: Object.fromEntries(prev.items.map((i) => [i.id, null])),
        },
      ],
    }));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {q.title}
            <StatusBadge status={q.status} />
          </DialogTitle>
          <DialogDescription>
            Preencha o preço unitário de cada fornecedor — o melhor preço é destacado em verde.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[65vh] overflow-auto">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={addSupplier} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Fornecedor
            </Button>
            <span className="text-xs text-muted-foreground">
              {q.items.length} item(ns) · {q.suppliers.length} fornecedor(es)
            </span>
          </div>

          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Item</TableHead>
                  <TableHead className="w-20 text-center">Qtd.</TableHead>
                  {q.suppliers.map((s) => (
                    <TableHead key={s.id} className="text-right min-w-[140px]">
                      {s.supplier}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.items.map((it) => {
                  const prices = q.suppliers
                    .map((s) => unitTotal(s.prices[it.id]))
                    .filter((v) => v > 0);
                  const minUnit = prices.length ? Math.min(...prices) : null;
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.name}</TableCell>
                      <TableCell className="text-center">{it.quantity}</TableCell>
                      {q.suppliers.map((s) => {
                        const v = unitTotal(s.prices[it.id]);
                        const isMin = minUnit != null && v === minUnit;
                        return (
                          <TableCell key={s.id} className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={v || ""}
                              onChange={(e) => updatePrice(s.id, it.id, e.target.value)}
                              className={
                                "h-9 text-right " +
                                (isMin
                                  ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30 font-bold text-emerald-700 dark:text-emerald-300"
                                  : "")
                              }
                              placeholder="0,00"
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );

                })}
              </TableBody>
            </Table>
          </div>

          {/* Totais por fornecedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {totals.map((t) => {
              const isWinner = q.winnerSupplierId === t.id;
              const isBest = t.total > 0 && t.total === minTotal;
              return (
                <Card
                  key={t.id}
                  className={
                    "p-4 transition-colors " +
                    (isWinner
                      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
                      : isBest
                        ? "border-emerald-300"
                        : "")
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold text-sm">{t.name}</span>
                    </div>
                    {isBest && (
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300">
                        <Trophy className="h-3 w-3 mr-1" /> Melhor
                      </Badge>
                    )}
                  </div>
                  <div className="text-2xl font-black mt-2">R$ {t.total.toFixed(2)}</div>
                  <Button
                    size="sm"
                    variant={isWinner ? "default" : "outline"}
                    className="mt-2 w-full gap-2"
                    onClick={() => pickWinner(t.id)}
                    disabled={t.total <= 0}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isWinner ? "Vencedor" : "Escolher"}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={() => {
              if (window.confirm("Excluir esta cotação?")) onDelete(q.id);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={save}>Salvar alterações</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
