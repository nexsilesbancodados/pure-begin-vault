// Central de Exportação — Estoque (compatível com Premier ERP)
// ATENÇÃO: este módulo NÃO altera nenhuma outra exportação.
// Layout do CSV é idêntico ao products.csv gerado pelo pacote Premier
// (src/lib/export/sales.ts), mesmas colunas, delimitador ";" e BOM UTF-8.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Package,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { downloadCsv } from "@/lib/export/csv";
import { classifyProduct, type ProductClass } from "@/lib/product-classification";

// ── Colunas EXATAS do products.csv Premier (não renomear, não reordenar) ──
const PREMIER_STOCK_COLUMNS = [
  "produto_id","sku","codigo_barras","nome","marca","modelo","categoria",
  "capacidade","cor","custo","preco_venda","estoque","fornecedor_id","empresa_id",
  "internal_code","external_code","reference","ncm","has_imei","active","location",
  "image_url","metadata","unit","weight","min_stock","wholesale_price",
  "created_at","updated_at","status",
] as const;

type ProductRow = {
  id: string;
  organization_id: string | null;
  sku: string | null;
  ean: string | null;
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  cost_price: number | null;
  price: number | null;
  stock_quantity: number | null;
  supplier_id: string | null;
  reference: string | null;
  ncm: string | null;
  has_imei: boolean | null;
  active: boolean | null;
  location: string | null;
  image_url: string | null;
  metadata: any;
  unit: string | null;
  weight: number | null;
  min_stock: number | null;
  wholesale_price: number | null;
  created_at: string | null;
  updated_at: string | null;
};

// NOTA: colunas como storage/capacity/color/sale_price NÃO existem em public.products.
// Capacidade e cor ficam em metadata (jsonb); preço de venda usa a coluna `price`.
const PRODUCT_SELECT = [
  "id","organization_id","sku","ean","name","brand","model","category",
  "cost_price","price","stock_quantity",
  "supplier_id","reference","ncm","has_imei","active","location","image_url",
  "metadata","unit","weight","min_stock","wholesale_price","created_at","updated_at",
].join(",");

const yesNo = (b: boolean) => (b ? "sim" : "nao");

const metaVal = (md: any, ...keys: string[]): string => {
  if (!md || typeof md !== "object") return "";
  for (const k of keys) {
    const v = md[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return "";
};

function toPremierRow(p: ProductRow) {
  const md = p.metadata;
  const qtyRaw = p.stock_quantity;
  const qty = Number(qtyRaw ?? 0);
  const status =
    !Number.isFinite(qty) ? "INVALID_STOCK"
    : qty < 0 ? "NEGATIVE_STOCK"
    : qty === 0 ? "ZERO_STOCK"
    : "OK";
  return {
    produto_id: p.id,
    sku: p.sku ?? "",
    codigo_barras: p.ean ?? "",
    nome: p.name ?? "",
    marca: p.brand ?? "",
    modelo: p.model ?? "",
    categoria: p.category ?? "",
    capacidade: metaVal(md, "capacidade", "capacity", "storage", "gb"),
    cor: metaVal(md, "cor", "color"),
    custo: p.cost_price ?? 0,
    preco_venda: p.price ?? 0,
    estoque: Number.isFinite(qty) ? qty : 0,
    fornecedor_id: p.supplier_id ?? "",
    empresa_id: p.organization_id ?? "",
    internal_code: p.reference ?? "",
    external_code: "",
    reference: p.reference ?? "",
    ncm: p.ncm ?? "",
    has_imei: p.has_imei == null ? "" : yesNo(!!p.has_imei),
    active: p.active == null ? "" : yesNo(!!p.active),
    location: p.location ?? "",
    image_url: p.image_url ?? "",
    metadata: md ? JSON.stringify(md) : "",
    unit: p.unit ?? "",
    weight: p.weight ?? "",
    min_stock: p.min_stock ?? "",
    wholesale_price: p.wholesale_price ?? "",
    created_at: p.created_at ?? "",
    updated_at: p.updated_at ?? "",
    status,
  };
}

type Issue = { tipo: string; quantidade: number; amostra: string[]; bloqueia: boolean };

type Snapshot = {
  loadedAt: number;
  products: ProductRow[];
  dbCount: number;
  dbStockSum: number;
  issues: Issue[];
  duplicatedSkus: Set<string>;
  duplicatedEans: Set<string>;
  ignoredIds: Set<string>;
};

async function fetchAllProducts(orgId: string): Promise<ProductRow[]> {
  const pageSize = 1000;
  let from = 0;
  const all: ProductRow[] = [];
  // paginação para suportar milhares de SKUs sem estourar o limit do Supabase
  // (uma consulta por página, mesma projeção)
  while (true) {
    const { data, error } = await (supabase as any)
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("organization_id", orgId)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as ProductRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchDbTotals(orgId: string) {
  // count exato + soma via RPC alternativa (soma no cliente é usada como fonte final;
  // o count do banco serve para reconciliação de quantidade de registros).
  const { count } = await (supabase as any)
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return { dbCount: Number(count ?? 0) };
}

function analyze(products: ProductRow[]): Pick<Snapshot, "issues" | "duplicatedSkus" | "duplicatedEans" | "ignoredIds" | "dbStockSum"> {
  const skuMap = new Map<string, number>();
  const eanMap = new Map<string, number>();
  for (const p of products) {
    if (p.sku && p.sku.trim()) skuMap.set(p.sku.trim(), (skuMap.get(p.sku.trim()) ?? 0) + 1);
    if (p.ean && p.ean.trim()) eanMap.set(p.ean.trim(), (eanMap.get(p.ean.trim()) ?? 0) + 1);
  }
  const duplicatedSkus = new Set<string>();
  for (const [k, v] of skuMap) if (v > 1) duplicatedSkus.add(k);
  const duplicatedEans = new Set<string>();
  for (const [k, v] of eanMap) if (v > 1) duplicatedEans.add(k);

  const semIdentificador: ProductRow[] = []; // BLOQUEIA: sem SKU, sem EAN e sem ID interno
  const qtdInvalida: ProductRow[] = [];      // BLOQUEIA: NaN
  const semVinculo: ProductRow[] = [];       // BLOQUEIA: sem organization_id
  const semEan: ProductRow[] = [];           // aviso
  const semMarca: ProductRow[] = [];         // aviso
  const semCategoria: ProductRow[] = [];     // aviso
  const negativos: ProductRow[] = [];        // aviso (exporta com status=NEGATIVE_STOCK)
  const zerados: ProductRow[] = [];          // aviso (exporta normalmente)
  const dupSkuRows: ProductRow[] = [];
  const dupEanRows: ProductRow[] = [];
  let dbStockSum = 0;

  for (const p of products) {
    const sku = (p.sku ?? "").trim();
    const ean = (p.ean ?? "").trim();
    const idInterno = (p.reference ?? "").trim() || (p.id ?? "").trim();
    const rawQty = p.stock_quantity;
    const qty = Number(rawQty ?? 0);
    const qtyOk = Number.isFinite(qty);
    if (qtyOk) dbStockSum += qty;

    if (!sku && !ean && !idInterno) semIdentificador.push(p);
    if (!qtyOk) qtdInvalida.push(p);
    if (!p.organization_id) semVinculo.push(p);
    if (!ean) semEan.push(p);
    if (!p.brand || !p.brand.trim()) semMarca.push(p);
    if (!p.category || !p.category.trim()) semCategoria.push(p);
    if (qtyOk && qty < 0) negativos.push(p);
    if (qtyOk && qty === 0) zerados.push(p);
    if (sku && duplicatedSkus.has(sku)) dupSkuRows.push(p);
    if (ean && duplicatedEans.has(ean)) dupEanRows.push(p);
  }

  // BLOQUEANTES: apenas produtos sem NENHUM identificador, quantidade inválida ou sem loja.
  const ignoredIds = new Set<string>([
    ...semIdentificador.map((p) => p.id),
    ...qtdInvalida.map((p) => p.id),
    ...semVinculo.map((p) => p.id),
  ]);

  const amostra = (list: ProductRow[]) =>
    list.slice(0, 10).map((p) => `${p.sku || p.ean || p.reference || p.id || "—"} · ${p.name ?? "sem nome"}`);

  const issues: Issue[] = [
    // Bloqueantes
    { tipo: "Sem identificador (sem SKU, sem EAN e sem ID interno)", quantidade: semIdentificador.length, amostra: amostra(semIdentificador), bloqueia: true },
    { tipo: "Quantidade inválida (NaN)", quantidade: qtdInvalida.length, amostra: amostra(qtdInvalida), bloqueia: true },
    { tipo: "Sem vínculo com loja (organization_id)", quantidade: semVinculo.length, amostra: amostra(semVinculo), bloqueia: true },
    // Avisos (nunca bloqueiam)
    { tipo: "Sem EAN (aviso)", quantidade: semEan.length, amostra: amostra(semEan), bloqueia: false },
    { tipo: "Sem marca (aviso)", quantidade: semMarca.length, amostra: amostra(semMarca), bloqueia: false },
    { tipo: "Sem categoria (aviso)", quantidade: semCategoria.length, amostra: amostra(semCategoria), bloqueia: false },
    { tipo: "Estoque negativo (aviso · exportado como NEGATIVE_STOCK)", quantidade: negativos.length, amostra: amostra(negativos), bloqueia: false },
    { tipo: "Sem estoque (aviso · exportado)", quantidade: zerados.length, amostra: amostra(zerados), bloqueia: false },
    { tipo: "Duplicados por SKU", quantidade: dupSkuRows.length, amostra: amostra(dupSkuRows), bloqueia: false },
    { tipo: "Duplicados por código de barras", quantidade: dupEanRows.length, amostra: amostra(dupEanRows), bloqueia: false },
  ];

  return { issues, duplicatedSkus, duplicatedEans, ignoredIds, dbStockSum };
}

type StockFilters = {
  stockPositive: boolean;
  includeZero: boolean;
  includeNegative: boolean;
  onlyActive: boolean;
  includeInactive: boolean;
  imei: "all" | "with" | "without";
  categories: string[];
  brands: string[];
  locations: string[];
  qtyMin: string;
  qtyMax: string;
  costMin: string;
  costMax: string;
  priceMin: string;
  priceMax: string;
  search: string;
  dedupe: boolean;
  latestOnly: boolean;
};

const DEFAULT_FILTERS: StockFilters = {
  stockPositive: true,
  includeZero: false,
  includeNegative: false,
  onlyActive: true,
  includeInactive: false,
  imei: "all",
  categories: [],
  brands: [],
  locations: [],
  qtyMin: "",
  qtyMax: "",
  costMin: "",
  costMax: "",
  priceMin: "",
  priceMax: "",
  search: "",
  dedupe: false,
  latestOnly: false,
};

export function StockAssistant({ orgId }: { orgId: string | null }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<StockFilters>(DEFAULT_FILTERS);
  const setF = <K extends keyof StockFilters>(k: K, v: StockFilters[K]) =>
    setFilters((prev) => ({ ...prev, [k]: v }));
  const toggleInList = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  const [lastReport, setLastReport] = useState<null | {
    exportedCount: number;
    exportedStockSum: number;
    withoutStock: number;
    ignored: number;
    inconsistencies: number;
    ms: number;
    kb: number;
    reconcileOk: boolean;
    diffCount: number;
    diffStock: number;
    filename: string;
  }>(null);

  const loadSnapshot = async () => {
    if (!orgId) return;
    setLoading(true);
    setLastReport(null);
    try {
      const t0 = performance.now();
      const [products, totals] = await Promise.all([
        fetchAllProducts(orgId),
        fetchDbTotals(orgId),
      ]);
      const a = analyze(products);
      const snap: Snapshot = {
        loadedAt: Date.now(),
        products,
        dbCount: totals.dbCount || products.length,
        ...a,
      };
      setSnapshot(snap);
      // eslint-disable-next-line no-console
      console.info(`[Estoque] snapshot carregado em ${((performance.now() - t0) / 1000).toFixed(2)}s`, {
        produtos: snap.products.length,
        banco: snap.dbCount,
        soma_estoque: snap.dbStockSum,
      });
    } catch (e: any) {
      toast.error(`Falha ao carregar estoque: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) void loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const facets = useMemo(() => {
    const cats = new Set<string>();
    const brs = new Set<string>();
    const locs = new Set<string>();
    for (const p of snapshot?.products ?? []) {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
      if (p.brand && p.brand.trim()) brs.add(p.brand.trim());
      if (p.location && p.location.trim()) locs.add(p.location.trim());
    }
    return {
      categories: [...cats].sort(),
      brands: [...brs].sort(),
      locations: [...locs].sort(),
    };
  }, [snapshot]);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const filteredProducts = useMemo<ProductRow[]>(() => {
    if (!snapshot) return [];
    const qMin = num(filters.qtyMin);
    const qMax = num(filters.qtyMax);
    const cMin = num(filters.costMin);
    const cMax = num(filters.costMax);
    const pMin = num(filters.priceMin);
    const pMax = num(filters.priceMax);
    const search = filters.search.trim().toLowerCase();

    let list = snapshot.products.filter((p) => !snapshot.ignoredIds.has(p.id));

    list = list.filter((p) => {
      const q = Number(p.stock_quantity ?? 0);
      if (!Number.isFinite(q)) return false;
      if (q > 0 && !filters.stockPositive) return false;
      if (q === 0 && !filters.includeZero) return false;
      if (q < 0 && !filters.includeNegative) return false;
      return true;
    });

    list = list.filter((p) => {
      const active = p.active !== false;
      if (active && !filters.onlyActive) return false;
      if (!active && !filters.includeInactive) return false;
      return true;
    });

    if (filters.imei !== "all") {
      list = list.filter((p) =>
        filters.imei === "with" ? !!p.has_imei : !p.has_imei,
      );
    }

    if (filters.categories.length)
      list = list.filter((p) => filters.categories.includes((p.category ?? "").trim()));
    if (filters.brands.length)
      list = list.filter((p) => filters.brands.includes((p.brand ?? "").trim()));
    if (filters.locations.length)
      list = list.filter((p) => filters.locations.includes((p.location ?? "").trim()));

    list = list.filter((p) => {
      const q = Number(p.stock_quantity ?? 0);
      if (qMin != null && q < qMin) return false;
      if (qMax != null && q > qMax) return false;
      return true;
    });

    list = list.filter((p) => {
      const cost = Number(p.cost_price ?? 0);
      const price = Number(p.price ?? 0);
      if (cMin != null && cost < cMin) return false;
      if (cMax != null && cost > cMax) return false;
      if (pMin != null && price < pMin) return false;
      if (pMax != null && price > pMax) return false;
      return true;
    });

    if (search) {
      list = list.filter((p) =>
        [p.sku, p.name, p.ean, p.model]
          .map((s) => (s ?? "").toLowerCase())
          .some((s) => s.includes(search)),
      );
    }

    if (filters.dedupe || filters.latestOnly) {
      const byKey = new Map<string, ProductRow>();
      for (const p of list) {
        const key = (p.sku && p.sku.trim()) || (p.ean && p.ean.trim()) || p.id;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, p);
        } else if (filters.latestOnly) {
          const a = new Date(existing.updated_at ?? existing.created_at ?? 0).getTime();
          const b = new Date(p.updated_at ?? p.created_at ?? 0).getTime();
          if (b > a) byKey.set(key, p);
        }
      }
      list = [...byKey.values()];
    }

    return list;
  }, [snapshot, filters]);

  const previewRows = useMemo(() => filteredProducts.map(toPremierRow), [filteredProducts]);

  const telefoniaAudit = useMemo(() => {
    // Classificação inteligente (não altera o CSV — apenas auditoria/estatística).
    const classified = filteredProducts.map((p) => ({ p, c: classifyProduct(p as any) }));
    const byClass = (cls: ProductClass) => classified.filter((x) => x.c === cls).map((x) => x.p);

    const smartphones = byClass("smartphone");
    const tablets = byClass("tablet");
    const smartwatches = byClass("smartwatch");
    const accessories = byClass("acessorio");
    const others = byClass("outro");

    const hasImeiValue = (p: any) => {
      const md: any = p.metadata ?? {};
      const val = String(md.imei ?? md.imei_1 ?? "").trim();
      return val !== "" || Number(md.imei_count ?? 0) > 0 || p.has_imei === true;
    };
    const withImei = smartphones.filter(hasImeiValue);
    const withoutImei = smartphones.filter((p) => !withImei.includes(p));

    const units = (arr: any[]) => arr.reduce((s, p) => s + Number(p.stock_quantity ?? 0), 0);
    const totalUnits = units(filteredProducts);
    const smartphoneUnits = units(smartphones);
    const accessoryUnits = units(accessories);
    const tabletUnits = units(tablets);
    const smartwatchUnits = units(smartwatches);
    const otherUnits = units(others);

    const zeroCount = filteredProducts.filter((p) => Number(p.stock_quantity ?? 0) === 0).length;
    const negativeCount = filteredProducts.filter((p) => Number(p.stock_quantity ?? 0) < 0).length;
    const coverage = smartphones.length === 0 ? 100 : (withImei.length / smartphones.length) * 100;

    // Comparação "antes vs depois": legado usava apenas has_imei.
    const legacySmartphones = filteredProducts.filter((p) => !!p.has_imei);
    const legacyAccessories = filteredProducts.filter((p) => !p.has_imei);
    const changedCount = filteredProducts.filter((p) => {
      const wasSmart = !!p.has_imei;
      const isSmart = classifyProduct(p as any) === "smartphone";
      return wasSmart !== isSmart;
    }).length;

    return {
      totalFound: snapshot?.products.length ?? 0,
      totalExported: filteredProducts.length,
      smartphonesCount: smartphones.length,
      tabletsCount: tablets.length,
      smartwatchesCount: smartwatches.length,
      accessoriesCount: accessories.length,
      othersCount: others.length,
      totalUnits,
      smartphoneUnits,
      accessoryUnits,
      tabletUnits,
      smartwatchUnits,
      otherUnits,
      zeroCount,
      negativeCount,
      withImei,
      withoutImei,
      coverage,
      legacySmartphonesCount: legacySmartphones.length,
      legacyAccessoriesCount: legacyAccessories.length,
      changedCount,
    };
  }, [filteredProducts, snapshot]);

  const previewStockSum = useMemo(
    () => previewRows.reduce((s, r) => s + Number(r.estoque || 0), 0),
    [previewRows],
  );
  const previewCostSum = useMemo(
    () => previewRows.reduce((s, r) => s + Number(r.custo || 0) * Number(r.estoque || 0), 0),
    [previewRows],
  );
  const previewPriceSum = useMemo(
    () => previewRows.reduce((s, r) => s + Number(r.preco_venda || 0) * Number(r.estoque || 0), 0),
    [previewRows],
  );
  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const doExport = async () => {
    if (!snapshot) return;
    setExporting(true);
    try {
      const t0 = performance.now();
      const filename = `estoque_premier_${new Date().toISOString().slice(0, 10)}.csv`;
      const bytes = downloadCsv(filename, previewRows, [...PREMIER_STOCK_COLUMNS]);
      const ms = performance.now() - t0;

      const exportedCount = previewRows.length;
      const exportedStockSum = previewStockSum;
      const withoutStock = previewRows.filter((r) => Number(r.estoque || 0) === 0).length;
      const ignored = snapshot.ignoredIds.size;
      const inconsistencies = snapshot.issues
        .filter((i) => i.bloqueia)
        .reduce((s, i) => s + i.quantidade, 0);

      const diffCount = snapshot.dbCount - (exportedCount + ignored);
      const diffStock = snapshot.dbStockSum - exportedStockSum;
      // Só considera 100% ok quando: nada foi ignorado E somas batem
      const reconcileOk = ignored === 0 && diffCount === 0 && diffStock === 0;

      const report = {
        exportedCount,
        exportedStockSum,
        withoutStock,
        ignored,
        inconsistencies,
        ms: Math.round(ms),
        kb: Number((bytes / 1024).toFixed(1)),
        reconcileOk,
        diffCount,
        diffStock,
        filename,
      };
      setLastReport(report);
      // eslint-disable-next-line no-console
      console.info("[Estoque] relatório final", report);
      toast.success(`Estoque exportado: ${filename}`);
    } catch (e: any) {
      toast.error(`Falha na exportação: ${e?.message ?? e}`);
    } finally {
      setExporting(false);
    }
  };

  const blocking = snapshot?.issues.filter((i) => i.bloqueia && i.quantidade > 0) ?? [];
  const warnings = snapshot?.issues.filter((i) => !i.bloqueia && i.quantidade > 0) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Estoque para Premier ERP
            <Badge variant="outline" className="ml-2 text-[10px]">
              Layout inalterado · UTF-8 · delimitador ";"
            </Badge>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={loadSnapshot} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Recarregar snapshot
          </Button>
        </CardHeader>
        <CardContent>
          {!snapshot ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              {loading ? "Carregando estoque..." : "Selecione uma loja para carregar o estoque."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Kpi icon={Package} label="SKUs no banco" value={snapshot.dbCount.toLocaleString("pt-BR")} />
              <Kpi icon={Boxes} label="Unidades (banco)" value={snapshot.dbStockSum.toLocaleString("pt-BR")} />
              <Kpi icon={CheckCircle2} label="Serão exportados" value={previewRows.length.toLocaleString("pt-BR")} tone="success" />
              <Kpi icon={XCircle} label="Serão ignorados" value={snapshot.ignoredIds.size.toLocaleString("pt-BR")} tone={snapshot.ignoredIds.size > 0 ? "warning" : "muted"} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros da Exportação */}
      {snapshot && (
        <Card className="border-primary/30">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Filtros da Exportação
              <Badge variant="outline" className="text-[10px]">Layout do CSV inalterado</Badge>
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Restaurar padrão
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {/* Estoque + Status + IMEI */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FilterBox title="Estoque">
                <Chk label="Somente estoque positivo (> 0)" v={filters.stockPositive} on={(x) => setF("stockPositive", x)} />
                <Chk label="Incluir produtos zerados" v={filters.includeZero} on={(x) => setF("includeZero", x)} />
                <Chk label="Incluir estoque negativo" v={filters.includeNegative} on={(x) => setF("includeNegative", x)} />
              </FilterBox>
              <FilterBox title="Status do produto">
                <Chk label="Apenas produtos ativos" v={filters.onlyActive} on={(x) => setF("onlyActive", x)} />
                <Chk label="Incluir inativos" v={filters.includeInactive} on={(x) => setF("includeInactive", x)} />
              </FilterBox>
              <FilterBox title="IMEI">
                <Rad name="imei" label="Todos" v={filters.imei === "all"} on={() => setF("imei", "all")} />
                <Rad name="imei" label="Apenas com IMEI" v={filters.imei === "with"} on={() => setF("imei", "with")} />
                <Rad name="imei" label="Apenas sem IMEI" v={filters.imei === "without"} on={() => setF("imei", "without")} />
              </FilterBox>
            </div>

            {/* Categoria / Marca / Local */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ChipMulti
                title={`Categoria (${filters.categories.length || "todas"})`}
                options={facets.categories}
                selected={filters.categories}
                onToggle={(v) => setF("categories", toggleInList(filters.categories, v))}
                onClear={() => setF("categories", [])}
              />
              <ChipMulti
                title={`Marca (${filters.brands.length || "todas"})`}
                options={facets.brands}
                selected={filters.brands}
                onToggle={(v) => setF("brands", toggleInList(filters.brands, v))}
                onClear={() => setF("brands", [])}
              />
              <ChipMulti
                title={`Local (${filters.locations.length || "todos"})`}
                options={facets.locations}
                selected={filters.locations}
                onToggle={(v) => setF("locations", toggleInList(filters.locations, v))}
                onClear={() => setF("locations", [])}
              />
            </div>

            {/* Faixas + busca */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FilterBox title="Faixa de quantidade">
                <div className="flex gap-2">
                  <NumIn label="Mín" v={filters.qtyMin} on={(x) => setF("qtyMin", x)} />
                  <NumIn label="Máx" v={filters.qtyMax} on={(x) => setF("qtyMax", x)} />
                </div>
              </FilterBox>
              <FilterBox title="Preço de custo">
                <div className="flex gap-2">
                  <NumIn label="Mín" v={filters.costMin} on={(x) => setF("costMin", x)} />
                  <NumIn label="Máx" v={filters.costMax} on={(x) => setF("costMax", x)} />
                </div>
              </FilterBox>
              <FilterBox title="Preço de venda">
                <div className="flex gap-2">
                  <NumIn label="Mín" v={filters.priceMin} on={(x) => setF("priceMin", x)} />
                  <NumIn label="Máx" v={filters.priceMax} on={(x) => setF("priceMax", x)} />
                </div>
              </FilterBox>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FilterBox title="Busca (SKU, nome, código de barras, modelo)">
                <input
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                  placeholder="Digite para filtrar..."
                  value={filters.search}
                  onChange={(e) => setF("search", e.target.value)}
                />
              </FilterBox>
              <FilterBox title="Duplicados">
                <Chk label="Ignorar produtos duplicados (mesmo SKU/EAN)" v={filters.dedupe} on={(x) => setF("dedupe", x)} />
                <Chk label="Exportar apenas o registro mais recente" v={filters.latestOnly} on={(x) => setF("latestOnly", x)} />
              </FilterBox>
            </div>

            {/* Resumo em tempo real */}
            <div className="rounded-md border bg-primary/5 px-3 py-2 grid grid-cols-2 md:grid-cols-5 gap-2">
              <Sum label="Encontrados" value={previewRows.length.toLocaleString("pt-BR")} />
              <Sum label="Serão exportados" value={previewRows.length.toLocaleString("pt-BR")} />
              <Sum label="Qtd. total" value={previewStockSum.toLocaleString("pt-BR")} />
              <Sum label="Valor custo" value={brl(previewCostSum)} />
              <Sum label="Valor venda" value={brl(previewPriceSum)} />
            </div>
          </CardContent>
        </Card>
      )}


      {/* Integridade */}
      {snapshot && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Integridade dos dados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.issues.length === 0 ? (
              <div className="text-xs text-muted-foreground">Sem verificações.</div>
            ) : (
              snapshot.issues.map((i) => {
                const zero = i.quantidade === 0;
                const cls = zero
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : i.bloqueia
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400";
                return (
                  <div key={i.tipo} className={`text-xs border rounded-md px-3 py-2 ${cls}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {zero ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        <span className="font-bold">{i.tipo}</span>
                        {i.bloqueia && !zero && <Badge variant="outline" className="text-[9px]">bloqueia</Badge>}
                      </div>
                      <span className="font-black tabular-nums">{i.quantidade.toLocaleString("pt-BR")}</span>
                    </div>
                    {!zero && i.amostra.length > 0 && (
                      <ul className="mt-1 ml-5 list-disc text-[10px] opacity-80">
                        {i.amostra.map((s, idx) => (
                          <li key={idx} className="truncate">{s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* Reconciliação + exportar */}
      {snapshot && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4" /> Prévia da exportação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-primary/5 px-3 py-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span>Registros no banco</span>
                <span className="font-black tabular-nums">{snapshot.dbCount.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Registros que serão exportados</span>
                <span className="font-black tabular-nums">{previewRows.length.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Registros ignorados (inconsistências bloqueantes)</span>
                <span className="font-black tabular-nums">{snapshot.ignoredIds.size.toLocaleString("pt-BR")}</span>
              </div>
              <hr className="my-1 border-primary/20" />
              <div className="flex items-center justify-between">
                <span>Soma de estoque no banco</span>
                <span className="font-black tabular-nums">{snapshot.dbStockSum.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Soma de estoque exportada</span>
                <span className="font-black tabular-nums">{previewStockSum.toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span>Diferença</span>
                <span className={`tabular-nums ${snapshot.dbStockSum - previewStockSum === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                  {(snapshot.dbStockSum - previewStockSum).toLocaleString("pt-BR")} un.
                </span>
              </div>
            </div>

            {blocking.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {snapshot.ignoredIds.size.toLocaleString("pt-BR")} produto(s) serão <strong>ignorados</strong> por inconsistências
                  bloqueantes. Corrija a origem se quiser que apareçam no Premier.
                </span>
              </div>
            )}

            <div className="text-[11px] text-muted-foreground">
              Ajuste as regras no card <strong>Filtros da Exportação</strong> acima
              para alterar quais registros entram no CSV.
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold">Compatível com:</span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1">
                <BadgeCheck className="h-3 w-3" /> Premier ERP · products.csv
              </Badge>
              <span className="text-muted-foreground">{PREMIER_STOCK_COLUMNS.length} colunas</span>
            </div>

            {/* Resumo da Exportação — auditoria de telefonia */}
            <div className="rounded-md border border-primary/30 bg-background p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <ShieldCheck className="h-4 w-4 text-primary" /> Resumo da Exportação (Telefonia)
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Sum label="Encontrados" value={telefoniaAudit.totalFound.toLocaleString("pt-BR")} />
                <Sum label="Exportados" value={telefoniaAudit.totalExported.toLocaleString("pt-BR")} />
                <Sum label="Smartphones" value={telefoniaAudit.smartphonesCount.toLocaleString("pt-BR")} />
                <Sum label="Acessórios" value={telefoniaAudit.accessoriesCount.toLocaleString("pt-BR")} />
                <Sum label="Unidades exportadas" value={telefoniaAudit.totalUnits.toLocaleString("pt-BR")} />
                <Sum label="Produtos zerados" value={telefoniaAudit.zeroCount.toLocaleString("pt-BR")} />
                <Sum label="Produtos negativos" value={telefoniaAudit.negativeCount.toLocaleString("pt-BR")} />
                <Sum label="Cobertura IMEI" value={`${telefoniaAudit.coverage.toFixed(1)}%`} />
              </div>

              {telefoniaAudit.smartphonesCount > 0 && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Sum label="Smartphones c/ IMEI" value={telefoniaAudit.withImei.length.toLocaleString("pt-BR")} />
                  <Sum label="Smartphones s/ IMEI" value={telefoniaAudit.withoutImei.length.toLocaleString("pt-BR")} />
                  <Sum label="Unid. smartphones" value={telefoniaAudit.smartphoneUnits.toLocaleString("pt-BR")} />
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs border">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-2 py-1 border-b">Categoria</th>
                      <th className="text-right px-2 py-1 border-b">Produtos</th>
                      <th className="text-right px-2 py-1 border-b">Unidades</th>
                      <th className="text-right px-2 py-1 border-b">IMEIs</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1 border-b">Smartphones</td>
                      <td className="text-right tabular-nums px-2 py-1 border-b">{telefoniaAudit.smartphonesCount}</td>
                      <td className="text-right tabular-nums px-2 py-1 border-b">{telefoniaAudit.smartphoneUnits}</td>
                      <td className="text-right tabular-nums px-2 py-1 border-b">{telefoniaAudit.withImei.length}</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 border-b">Acessórios</td>
                      <td className="text-right tabular-nums px-2 py-1 border-b">{telefoniaAudit.accessoriesCount}</td>
                      <td className="text-right tabular-nums px-2 py-1 border-b">{telefoniaAudit.accessoryUnits}</td>
                      <td className="text-right tabular-nums px-2 py-1 border-b">—</td>
                    </tr>
                    <tr className="font-bold bg-muted/30">
                      <td className="px-2 py-1">Total</td>
                      <td className="text-right tabular-nums px-2 py-1">{telefoniaAudit.totalExported}</td>
                      <td className="text-right tabular-nums px-2 py-1">{telefoniaAudit.totalUnits}</td>
                      <td className="text-right tabular-nums px-2 py-1">{telefoniaAudit.withImei.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {telefoniaAudit.withoutImei.length > 0 && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="h-4 w-4" />
                    {telefoniaAudit.withoutImei.length} smartphone(s) sem IMEI
                  </div>
                  <ul className="list-disc pl-5 max-h-40 overflow-auto">
                    {telefoniaAudit.withoutImei.slice(0, 50).map((p) => (
                      <li key={p.id}>
                        <span className="font-medium">{p.name ?? "—"}</span>
                        <span className="text-muted-foreground"> · SKU: {p.sku ?? "—"}</span>
                      </li>
                    ))}
                    {telefoniaAudit.withoutImei.length > 50 && (
                      <li className="text-muted-foreground">
                        …e mais {telefoniaAudit.withoutImei.length - 50} produto(s).
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {telefoniaAudit.smartphonesCount > 0 && telefoniaAudit.withoutImei.length === 0 ? (
                <div className="rounded-md border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Todos os smartphones possuem IMEI e podem ser migrados com segurança.
                </div>
              ) : telefoniaAudit.withoutImei.length > 0 ? (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Existem smartphones sem IMEI. Recomenda-se corrigir antes da migração.
                </div>
              ) : null}
            </div>



            <Button
              size="lg"
              className="w-full gap-2 font-bold"
              onClick={doExport}
              disabled={exporting || previewRows.length === 0}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar Estoque (.csv)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Relatório final */}
      {lastReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" /> Relatório da exportação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Kpi icon={CheckCircle2} label="Exportados" value={lastReport.exportedCount.toLocaleString("pt-BR")} tone="success" />
              <Kpi icon={Boxes} label="Unidades exportadas" value={lastReport.exportedStockSum.toLocaleString("pt-BR")} />
              <Kpi icon={Package} label="Sem estoque" value={lastReport.withoutStock.toLocaleString("pt-BR")} tone="muted" />
              <Kpi icon={XCircle} label="Ignorados" value={lastReport.ignored.toLocaleString("pt-BR")} tone={lastReport.ignored ? "warning" : "muted"} />
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <span><strong>Inconsistências:</strong> {lastReport.inconsistencies.toLocaleString("pt-BR")}</span>
              <span><strong>Tempo:</strong> {(lastReport.ms / 1000).toFixed(2)}s</span>
              <span><strong>Arquivo:</strong> {lastReport.kb} KB</span>
              <span className="font-mono opacity-70">{lastReport.filename}</span>
            </div>
            <div
              className={`rounded-md border px-3 py-2 flex items-start gap-2 ${
                lastReport.reconcileOk
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              }`}
            >
              {lastReport.reconcileOk ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <div>
                <div className="font-bold">
                  {lastReport.reconcileOk
                    ? "Reconciliação: os totais conferem 100%."
                    : "Reconciliação: divergência detectada."}
                </div>
                {!lastReport.reconcileOk && (
                  <div className="text-[11px] opacity-90">
                    Diferença de registros (banco − exportado − ignorado): <strong>{lastReport.diffCount.toLocaleString("pt-BR")}</strong>
                    {" · "}
                    Diferença de unidades: <strong>{lastReport.diffStock.toLocaleString("pt-BR")}</strong>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "muted";
}) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center gap-2">
        <div className={`h-8 w-8 rounded-md flex items-center justify-center ${toneClass[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</div>
          <div className="text-lg font-black truncate tabular-nums" title={value}>{value}</div>
        </div>
      </div>
    </div>
  );
}

function FilterBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border px-3 py-2 space-y-1.5">
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Chk({ label, v, on }: { label: string; v: boolean; on: (x: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" className="h-3.5 w-3.5" checked={v} onChange={(e) => on(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Rad({ name, label, v, on }: { name: string; label: string; v: boolean; on: () => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="radio" name={name} className="h-3.5 w-3.5" checked={v} onChange={on} />
      <span>{label}</span>
    </label>
  );
}

function NumIn({ label, v, on }: { label: string; v: string; on: (x: string) => void }) {
  return (
    <label className="flex-1 flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        type="number"
        className="w-full rounded-md border bg-background px-2 py-1 text-xs"
        value={v}
        onChange={(e) => on(e.target.value)}
      />
    </label>
  );
}

function ChipMulti({
  title, options, selected, onToggle, onClear,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-md border px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{title}</div>
        {selected.length > 0 && (
          <button className="text-[10px] underline text-muted-foreground" onClick={onClear}>
            limpar
          </button>
        )}
      </div>
      {options.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">Sem valores no snapshot.</div>
      ) : (
        <div className="flex flex-wrap gap-1 max-h-28 overflow-auto">
          {options.map((op) => {
            const on = selected.includes(op);
            return (
              <button
                key={op}
                onClick={() => onToggle(op)}
                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                  on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                }`}
              >
                {op}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-black tabular-nums">{value}</div>
    </div>
  );
}

