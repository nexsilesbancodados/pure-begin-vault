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
import { rowsToCsv, downloadCsv } from "@/lib/export/csv";
import { classifyProduct, resolveHasImei, resolveImei, type ProductClass, CLASS_ORDER } from "@/lib/product-classification";

// Coerção segura para React children — nunca renderiza objeto cru.
const s = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
};

// Extrai IMEI(s) do metadata ou campos comuns (apenas exibição).
const extractImei = (p: any): string => {
  const md: any = p?.metadata && typeof p.metadata === "object" ? p.metadata : {};
  const raw =
    md.imei ?? md.imei_1 ?? md.imei1 ?? md.IMEI ??
    (Array.isArray(md.imeis) ? md.imeis.join(", ") : "") ??
    p?.imei ?? p?.imei1 ?? p?.serial_number ?? md.serial_number ?? "";
  return s(raw).trim();
};
// Regra ÚNICA em todo o módulo (auditoria + CSV).
const hasImeiValue = (p: any): boolean => resolveHasImei(p);

// Ordenação por classe (smartphones c/ IMEI → s/ IMEI → tablet → watch → acessório → outro)
// e dentro de cada grupo por marca, modelo, nome.
const CLASS_WEIGHT: Record<string, number> = {
  smartphone_with: 0,
  smartphone_without: 1,
  tablet: 2,
  smartwatch: 3,
  acessorio: 4,
  outro: 5,
};
function classKey(p: any): keyof typeof CLASS_WEIGHT {
  const c = classifyProduct(p);
  if (c === "smartphone") return hasImeiValue(p) ? "smartphone_with" : "smartphone_without";
  return c;
}
function sortForExport<T extends { p: any }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const wa = CLASS_WEIGHT[classKey(a.p)];
    const wb = CLASS_WEIGHT[classKey(b.p)];
    if (wa !== wb) return wa - wb;
    const cmp = (x: unknown, y: unknown) => s(x).localeCompare(s(y), "pt-BR", { sensitivity: "base" });
    return (
      cmp(a.p.brand, b.p.brand) ||
      cmp(a.p.model, b.p.model) ||
      cmp(a.p.name, b.p.name)
    );
  });
}

// ── Colunas EXATAS do products.csv Premier (não renomear, não reordenar) ──
const PREMIER_STOCK_COLUMNS = [
  "produto_id","sku","codigo_barras","nome","marca","modelo","categoria",
  "capacidade","cor","custo","preco_venda","estoque","fornecedor_id","empresa_id",
  "internal_code","external_code","reference","ncm","has_imei","imei","active","location",
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
    has_imei: yesNo(resolveHasImei(p)),
    imei: resolveImei(p),
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
};

const DEFAULT_FILTERS: StockFilters = {
  stockPositive: true,
  includeZero: false,
  includeNegative: false,
  onlyActive: true,
  includeInactive: false,
  imei: "all",
};


export function StockAssistant({ orgId }: { orgId: string | null }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<StockFilters>(DEFAULT_FILTERS);
  const setF = <K extends keyof StockFilters>(k: K, v: StockFilters[K]) =>
    setFilters((prev) => ({ ...prev, [k]: v }));

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
    // Conferência Auditoria ↔ CSV
    auditFound: number;
    auditExported: number;
    auditSmartphones: number;
    auditWithImei: number;
    auditWithoutImei: number;
    auditAccessories: number;
    auditTablets: number;
    auditSmartwatches: number;
    auditOthers: number;
    csvLines: number;
    csvSmartphones: number;
    csvWithImei: number;
    csvWithoutImei: number;
    csvAccessories: number;
    csvTablets: number;
    csvSmartwatches: number;
    csvOthers: number;
    parityAudit: boolean;
    parityCsv: boolean;
    result: "ok" | "diverg";
    exportedWithImei: number;
    imeiDiff: number;
    missingSkus: string[];
    divergences: Array<{ produto: string; sku: string; imei: string; fonte: string; motivo: string }>;
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

  const num = (_: string) => null; // legado — filtros de faixa removidos

  const filteredProducts = useMemo<ProductRow[]>(() => {
    if (!snapshot) return [];
    let list = snapshot.products.filter((p) => !snapshot.ignoredIds.has(p.id));

    // Estoque
    list = list.filter((p) => {
      const q = Number(p.stock_quantity ?? 0);
      if (!Number.isFinite(q)) return false;
      if (q > 0 && !filters.stockPositive) return false;
      if (q === 0 && !filters.includeZero) return false;
      if (q < 0 && !filters.includeNegative) return false;
      return true;
    });

    // Status
    list = list.filter((p) => {
      const active = p.active !== false;
      if (active && !filters.onlyActive) return false;
      if (!active && !filters.includeInactive) return false;
      return true;
    });

    // IMEI — só afeta aparelhos (smartphone/tablet/smartwatch). Acessórios passam sempre.
    if (filters.imei !== "all") {
      list = list.filter((p) => {
        const cls = classifyProduct(p as any);
        const isDevice = cls === "smartphone" || cls === "tablet" || cls === "smartwatch";
        if (!isDevice) return true;
        const has = resolveHasImei(p);
        return filters.imei === "with" ? has : !has;
      });
    }

    return list;
  }, [snapshot, filters]);


  const sortedFiltered = useMemo(
    () => sortForExport(filteredProducts.map((p) => ({ p }))).map((x) => x.p as ProductRow),
    [filteredProducts],
  );
  const previewRows = useMemo(() => sortedFiltered.map(toPremierRow), [sortedFiltered]);

  const telefoniaAudit = useMemo(() => {
    // Classificação inteligente (não altera o CSV — apenas auditoria/estatística).
    const classified = filteredProducts.map((p) => ({ p, c: classifyProduct(p as any) }));
    const byClass = (cls: ProductClass) => classified.filter((x) => x.c === cls).map((x) => x.p);

    const smartphones = byClass("smartphone");
    const tablets = byClass("tablet");
    const smartwatches = byClass("smartwatch");
    const accessories = byClass("acessorio");
    const others = byClass("outro");

    const withImei = smartphones.filter((p) => resolveHasImei(p));
    const withoutImei = smartphones.filter((p) => !resolveHasImei(p));

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

    // Comparação "antes vs depois": legado usava apenas has_imei bruto.
    const legacySmartphones = filteredProducts.filter((p) => p.has_imei === true);
    const legacyAccessories = filteredProducts.filter((p) => p.has_imei !== true);
    const changedCount = filteredProducts.filter((p) => {
      const wasSmart = p.has_imei === true;
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

      // ── Auditoria (fonte oficial: telefoniaAudit) ─────────────────────
      const auditFound = telefoniaAudit.totalFound;
      const auditExported = telefoniaAudit.totalExported;
      const auditSmartphones = telefoniaAudit.smartphonesCount;
      const auditWithImei = telefoniaAudit.withImei.length;
      const auditWithoutImei = telefoniaAudit.withoutImei.length;
      const auditAccessories = telefoniaAudit.accessoriesCount;
      const auditTablets = telefoniaAudit.tabletsCount;
      const auditSmartwatches = telefoniaAudit.smartwatchesCount;
      const auditOthers = telefoniaAudit.othersCount;

      // ── Guarda de paridade Auditoria ↔ conjunto exportado ─────────────
      const exportedIds = new Set(sortedFiltered.map((p) => p.id));
      const missing = telefoniaAudit.withImei.filter((p) => !exportedIds.has(p.id));
      const divergences: Array<{ produto: string; sku: string; imei: string; fonte: string; motivo: string }> = [];
      if (missing.length > 0) {
        for (const p of missing) {
          const imei = extractImei(p);
          const md: any = (p as any).metadata ?? {};
          const fonte =
            (p as any).has_imei === true ? "has_imei"
            : (p as any).imei ? "imei"
            : md.imei || md.imei_1 || md.imei1 ? "metadata.imei"
            : md.imeis ? "metadata.imeis"
            : md.serial_number ? "metadata.serial_number"
            : (p as any).serial_number ? "serial_number"
            : "desconhecida";
          divergences.push({
            produto: s(p.name),
            sku: s(p.sku) || s(p.ean) || s(p.id),
            imei,
            fonte,
            motivo: "Filtros removeram o registro do conjunto exportado.",
          });
        }
        const skus = missing.map((p) => s(p.sku) || s(p.ean) || s(p.id));
        console.error("[Estoque] divergência auditoria↔CSV", { missing: skus });
        toast.error(
          `Exportação bloqueada: ${missing.length} smartphone(s) com IMEI da auditoria não entrariam no CSV.`,
          { duration: 8000 },
        );
        setLastReport({
          exportedCount: 0, exportedStockSum: 0, withoutStock: 0,
          ignored: snapshot.ignoredIds.size, inconsistencies: 0,
          ms: Math.round(performance.now() - t0), kb: 0,
          reconcileOk: false, diffCount: 0, diffStock: 0,
          filename: "(exportação bloqueada)",
          auditFound, auditExported, auditSmartphones, auditWithImei, auditWithoutImei,
          auditAccessories, auditTablets, auditSmartwatches, auditOthers,
          csvLines: 0, csvSmartphones: 0, csvWithImei: 0, csvWithoutImei: 0,
          csvAccessories: 0, csvTablets: 0, csvSmartwatches: 0, csvOthers: 0,
          parityAudit: false, parityCsv: false, result: "diverg",
          exportedWithImei: auditWithImei - missing.length,
          imeiDiff: missing.length,
          missingSkus: skus,
          divergences,
        });
        return;
      }

      // ── Monta CSV em memória (mesma função usada no download) ─────────
      const filename = `estoque_premier_${new Date().toISOString().slice(0, 10)}.csv`;
      const csvText = rowsToCsv(previewRows, [...PREMIER_STOCK_COLUMNS]);

      // ── Validação: lê o próprio CSV e reclassifica pelo NOME (mesma
      // função de classificação usada na auditoria). has_imei do CSV foi
      // gerado com resolveHasImei — regra única. ────────────────────────
      const stripped = csvText.replace(/^\uFEFF/, "");
      const allLines = stripped.split("\n").filter((l) => l.length > 0);
      const header = allLines[0]?.split(";") ?? [];
      const dataLines = allLines.slice(1);
      const csvLines = dataLines.length;
      const idxNome = header.indexOf("nome");
      const idxMarca = header.indexOf("marca");
      const idxModelo = header.indexOf("modelo");
      const idxCategoria = header.indexOf("categoria");
      const idxHasImei = header.indexOf("has_imei");
      const idxImei = header.indexOf("imei");

      // parser CSV simples respeitando aspas
      const parseLine = (line: string): string[] => {
        const out: string[] = []; let cur = ""; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQ) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') inQ = false;
            else cur += ch;
          } else {
            if (ch === '"') inQ = true;
            else if (ch === ";") { out.push(cur); cur = ""; }
            else cur += ch;
          }
        }
        out.push(cur);
        return out;
      };

      let csvSmartphones = 0, csvWithImei = 0, csvWithoutImei = 0;
      let csvAccessories = 0, csvTablets = 0, csvSmartwatches = 0, csvOthers = 0;
      let csvImeiFilled = 0;
      for (const line of dataLines) {
        const cols = parseLine(line);
        const fake = {
          name: cols[idxNome] ?? "",
          brand: cols[idxMarca] ?? "",
          model: cols[idxModelo] ?? "",
          category: cols[idxCategoria] ?? "",
        };
        const cls = classifyProduct(fake as any);
        const hasImei = (cols[idxHasImei] ?? "").toLowerCase() === "sim";
        const imeiCell = (cols[idxImei] ?? "").trim();
        if (imeiCell) csvImeiFilled++;
        if (cls === "smartphone") {
          csvSmartphones++;
          if (hasImei) csvWithImei++; else csvWithoutImei++;
        } else if (cls === "tablet") csvTablets++;
        else if (cls === "smartwatch") csvSmartwatches++;
        else if (cls === "acessorio") csvAccessories++;
        else csvOthers++;
      }

      // Conferência extra: nº de linhas com coluna imei preenchida
      // deve ser igual ao total de smartphones com IMEI da auditoria.
      const imeiColumnParity = csvImeiFilled === auditWithImei;

      const parityAudit = csvLines === auditExported;
      const parityCsv =
        csvSmartphones === auditSmartphones &&
        csvWithImei === auditWithImei &&
        csvWithoutImei === auditWithoutImei &&
        csvAccessories === auditAccessories &&
        csvTablets === auditTablets &&
        csvSmartwatches === auditSmartwatches &&
        csvOthers === auditOthers;

      if (!parityAudit || !parityCsv) {
        console.error("[Estoque] divergência CSV↔Auditoria", {
          auditExported, csvLines,
          auditSmartphones, csvSmartphones,
          auditWithImei, csvWithImei,
          auditWithoutImei, csvWithoutImei,
          auditAccessories, csvAccessories,
          auditTablets, csvTablets,
          auditSmartwatches, csvSmartwatches,
          auditOthers, csvOthers,
        });
        toast.error("Exportação bloqueada: CSV divergente da auditoria. Veja Conferência Final.", { duration: 8000 });
        setLastReport({
          exportedCount: 0, exportedStockSum: 0, withoutStock: 0,
          ignored: snapshot.ignoredIds.size, inconsistencies: 0,
          ms: Math.round(performance.now() - t0), kb: 0,
          reconcileOk: false, diffCount: 0, diffStock: 0,
          filename: "(exportação bloqueada)",
          auditFound, auditExported, auditSmartphones, auditWithImei, auditWithoutImei,
          auditAccessories, auditTablets, auditSmartwatches, auditOthers,
          csvLines, csvSmartphones, csvWithImei, csvWithoutImei,
          csvAccessories, csvTablets, csvSmartwatches, csvOthers,
          parityAudit, parityCsv, result: "diverg",
          exportedWithImei: csvWithImei,
          imeiDiff: Math.abs(auditWithImei - csvWithImei),
          missingSkus: [],
          divergences,
        });
        return;
      }

      // ── Paridade OK: dispara o download real ──────────────────────────
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const bytes = blob.size;
      const ms = performance.now() - t0;

      const exportedCount = previewRows.length;
      const exportedStockSum = previewStockSum;
      const withoutStock = previewRows.filter((r) => Number(r.estoque || 0) === 0).length;
      const ignored = snapshot.ignoredIds.size;
      const inconsistencies = snapshot.issues.filter((i) => i.bloqueia).reduce((s, i) => s + i.quantidade, 0);
      const diffCount = snapshot.dbCount - (exportedCount + ignored);
      const diffStock = snapshot.dbStockSum - exportedStockSum;
      const reconcileOk = ignored === 0 && diffCount === 0 && diffStock === 0;

      const report = {
        exportedCount, exportedStockSum, withoutStock, ignored, inconsistencies,
        ms: Math.round(ms), kb: Number((bytes / 1024).toFixed(1)),
        reconcileOk, diffCount, diffStock, filename,
        auditFound, auditExported, auditSmartphones, auditWithImei, auditWithoutImei,
        auditAccessories, auditTablets, auditSmartwatches, auditOthers,
        csvLines, csvSmartphones, csvWithImei, csvWithoutImei,
        csvAccessories, csvTablets, csvSmartwatches, csvOthers,
        parityAudit: true, parityCsv: true, result: "ok" as const,
        exportedWithImei: csvWithImei,
        imeiDiff: 0,
        missingSkus: [] as string[],
        divergences: [] as Array<{ produto: string; sku: string; imei: string; fonte: string; motivo: string }>,
      };
      setLastReport(report);
      console.info("[Estoque] relatório final", report);
      toast.success(`Estoque exportado: ${filename} · ${csvWithImei}/${auditWithImei} c/ IMEI conferidos.`);
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
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Filtros da Exportação
              <Badge variant="outline" className="text-[10px]">Layout do CSV inalterado</Badge>
            </CardTitle>
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

              {/* Resumo em árvore */}
              <pre className="text-[11px] font-mono bg-muted/30 rounded-md p-3 whitespace-pre-wrap leading-relaxed">
{`Smartphones........${telefoniaAudit.smartphonesCount}
├── Com IMEI.......${telefoniaAudit.withImei.length}
└── Sem IMEI.......${telefoniaAudit.withoutImei.length}

Tablets............${telefoniaAudit.tabletsCount}

Smartwatch.........${telefoniaAudit.smartwatchesCount}

Acessórios.........${telefoniaAudit.accessoriesCount}

Outros.............${telefoniaAudit.othersCount}

Total exportado....${telefoniaAudit.totalExported}`}
              </pre>

              {/* Cobertura IMEI colorida */}
              {telefoniaAudit.smartphonesCount > 0 && (() => {
                const cov = telefoniaAudit.coverage;
                const tone =
                  cov < 50 ? { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" } :
                  cov <= 90 ? { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" } :
                  { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
                return (
                  <div className="rounded-md border p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold">Cobertura IMEI</span>
                      <span className={`font-black tabular-nums ${tone.text}`}>{cov.toFixed(0)}%</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {telefoniaAudit.withImei.length} / {telefoniaAudit.smartphonesCount} smartphones
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${tone.bar} transition-all`} style={{ width: `${Math.min(100, Math.max(0, cov))}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* KPIs por categoria */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Sum label="Encontrados" value={telefoniaAudit.totalFound.toLocaleString("pt-BR")} />
                <Sum label="Exportados" value={telefoniaAudit.totalExported.toLocaleString("pt-BR")} />
                <Sum label="Smartphones" value={telefoniaAudit.smartphonesCount.toLocaleString("pt-BR")} />
                <Sum label="Tablets" value={telefoniaAudit.tabletsCount.toLocaleString("pt-BR")} />
                <Sum label="Smartwatches" value={telefoniaAudit.smartwatchesCount.toLocaleString("pt-BR")} />
                <Sum label="Acessórios" value={telefoniaAudit.accessoriesCount.toLocaleString("pt-BR")} />
                <Sum label="Outros" value={telefoniaAudit.othersCount.toLocaleString("pt-BR")} />
                <Sum label="Unidades" value={telefoniaAudit.totalUnits.toLocaleString("pt-BR")} />
              </div>

              {/* Tabela Smartphones sem IMEI */}
              {telefoniaAudit.withoutImei.length > 0 && (
                <div className="rounded-md border border-amber-500/40 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <AlertTriangle className="h-4 w-4" />
                      Smartphones sem IMEI ({telefoniaAudit.withoutImei.length})
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-[11px]"
                      onClick={() => {
                        const rows = telefoniaAudit.withoutImei.map((p) => ({
                          produto: s(p.name), sku: s(p.sku),
                          estoque: Number(p.stock_quantity ?? 0),
                          marca: s(p.brand), categoria: s(p.category),
                        }));
                        downloadCsv(`smartphones_sem_imei_${new Date().toISOString().slice(0,10)}.csv`, rows,
                          ["produto","sku","estoque","marca","categoria"]);
                      }}
                    >
                      <Download className="h-3 w-3" /> Exportar CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-[11px]">
                      <thead className="bg-muted/40 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1 border-b">Produto</th>
                          <th className="text-left px-2 py-1 border-b">SKU</th>
                          <th className="text-right px-2 py-1 border-b">Estoque</th>
                          <th className="text-left px-2 py-1 border-b">Marca</th>
                          <th className="text-left px-2 py-1 border-b">Categoria</th>
                        </tr>
                      </thead>
                      <tbody>
                        {telefoniaAudit.withoutImei.slice(0, 200).map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="px-2 py-1">{s(p.name) || "—"}</td>
                            <td className="px-2 py-1 font-mono">{s(p.sku) || "—"}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{Number(p.stock_quantity ?? 0)}</td>
                            <td className="px-2 py-1">{s(p.brand) || "—"}</td>
                            <td className="px-2 py-1">{s(p.category) || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {telefoniaAudit.withoutImei.length > 200 && (
                      <div className="text-[10px] text-muted-foreground px-2 py-1">
                        Exibindo 200 de {telefoniaAudit.withoutImei.length}. Use "Exportar CSV" para a lista completa.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tabela Smartphones com IMEI */}
              {telefoniaAudit.withImei.length > 0 && (
                <div className="rounded-md border border-emerald-500/40 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4" />
                      Smartphones com IMEI ({telefoniaAudit.withImei.length})
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-[11px]"
                      onClick={() => {
                        const rows = telefoniaAudit.withImei.map((p) => ({
                          produto: s(p.name), sku: s(p.sku),
                          imei: extractImei(p),
                          quantidade: Number(p.stock_quantity ?? 0),
                        }));
                        downloadCsv(`smartphones_com_imei_${new Date().toISOString().slice(0,10)}.csv`, rows,
                          ["produto","sku","imei","quantidade"]);
                      }}
                    >
                      <Download className="h-3 w-3" /> Exportar CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-[11px]">
                      <thead className="bg-muted/40 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1 border-b">Produto</th>
                          <th className="text-left px-2 py-1 border-b">SKU</th>
                          <th className="text-left px-2 py-1 border-b">IMEI</th>
                          <th className="text-right px-2 py-1 border-b">Quantidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {telefoniaAudit.withImei.slice(0, 200).map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="px-2 py-1">{s(p.name) || "—"}</td>
                            <td className="px-2 py-1 font-mono">{s(p.sku) || "—"}</td>
                            <td className="px-2 py-1 font-mono">{extractImei(p) || "—"}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{Number(p.stock_quantity ?? 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {telefoniaAudit.withImei.length > 200 && (
                      <div className="text-[10px] text-muted-foreground px-2 py-1">
                        Exibindo 200 de {telefoniaAudit.withImei.length}. Use "Exportar CSV" para a lista completa.
                      </div>
                    )}
                  </div>
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

              <div className="text-[10px] text-muted-foreground">
                CSV do Premier ordenado por: smartphones c/ IMEI → s/ IMEI → tablets → smartwatches → acessórios → outros (marca, modelo, nome). Layout, colunas, delimitador e BOM UTF-8 inalterados.
              </div>
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

            {/* Paridade Auditoria ↔ CSV (Smartphones com IMEI) */}
            <div
              className={`rounded-md border px-3 py-2 ${
                lastReport.imeiDiff === 0
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-destructive/50 bg-destructive/10 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                {lastReport.imeiDiff === 0 ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                Paridade Auditoria ↔ CSV (Smartphones com IMEI)
              </div>
              <div className="grid grid-cols-3 gap-2 mt-1 text-[11px]">
                <div>Auditoria: <strong className="tabular-nums">{lastReport.auditWithImei}</strong></div>
                <div>CSV exportado: <strong className="tabular-nums">{lastReport.exportedWithImei}</strong></div>
                <div>Diferença: <strong className="tabular-nums">{lastReport.imeiDiff}</strong></div>
              </div>
              {lastReport.missingSkus.length > 0 && (
                <div className="mt-2 text-[11px]">
                  <div className="font-bold">SKUs ausentes no CSV:</div>
                  <ul className="ml-4 list-disc font-mono">
                    {lastReport.missingSkus.slice(0, 20).map((sku) => (
                      <li key={sku}>{sku}</li>
                    ))}
                  </ul>
                  {lastReport.missingSkus.length > 20 && (
                    <div className="opacity-70">…e mais {lastReport.missingSkus.length - 20}.</div>
                  )}
                </div>
              )}
            </div>

            {/* ── Conferência Final da Exportação ─────────────────────── */}
            <div
              className={`rounded-md border px-3 py-2 ${
                lastReport.result === "ok"
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-destructive/50 bg-destructive/10"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs">
                {lastReport.result === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                Conferência Final da Exportação
                <Badge variant="outline" className="text-[9px] ml-auto">
                  Regra única: resolveHasImei()
                </Badge>
              </div>

              <div className="overflow-x-auto mt-2">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-2 py-1 border-b">Métrica</th>
                      <th className="text-right px-2 py-1 border-b">Auditoria</th>
                      <th className="text-right px-2 py-1 border-b">CSV</th>
                      <th className="text-center px-2 py-1 border-b">OK</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    <ConfRow label="Produtos encontrados" a={lastReport.auditFound} c={lastReport.csvLines || lastReport.auditExported} skipCheck />
                    <ConfRow label="Produtos exportados" a={lastReport.auditExported} c={lastReport.csvLines} />
                    <ConfRow label="Smartphones" a={lastReport.auditSmartphones} c={lastReport.csvSmartphones} />
                    <ConfRow label="Smartphones c/ IMEI" a={lastReport.auditWithImei} c={lastReport.csvWithImei} />
                    <ConfRow label="Smartphones s/ IMEI" a={lastReport.auditWithoutImei} c={lastReport.csvWithoutImei} />
                    <ConfRow label="Tablets" a={lastReport.auditTablets} c={lastReport.csvTablets} />
                    <ConfRow label="Smartwatches" a={lastReport.auditSmartwatches} c={lastReport.csvSmartwatches} />
                    <ConfRow label="Acessórios" a={lastReport.auditAccessories} c={lastReport.csvAccessories} />
                    <ConfRow label="Outros" a={lastReport.auditOthers} c={lastReport.csvOthers} />
                    <tr>
                      <td className="px-2 py-1 border-t font-bold">Linhas do CSV</td>
                      <td className="px-2 py-1 text-right tabular-nums border-t" colSpan={2}>{lastReport.csvLines}</td>
                      <td className="px-2 py-1 text-center border-t">—</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-bold">Paridade Auditoria</td>
                      <td className="px-2 py-1 text-right" colSpan={2}>
                        {lastReport.parityAudit ? "conferido" : "divergente"}
                      </td>
                      <td className="px-2 py-1 text-center">{lastReport.parityAudit ? "✔" : "✖"}</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-bold">Paridade CSV</td>
                      <td className="px-2 py-1 text-right" colSpan={2}>
                        {lastReport.parityCsv ? "conferido" : "divergente"}
                      </td>
                      <td className="px-2 py-1 text-center">{lastReport.parityCsv ? "✔" : "✖"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div
                className={`mt-2 rounded-md px-2 py-1 text-xs font-bold ${
                  lastReport.result === "ok"
                    ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                    : "bg-destructive/20 text-destructive"
                }`}
              >
                Resultado: {lastReport.result === "ok" ? "✔ OK" : "✖ Divergência encontrada"}
              </div>

              {lastReport.divergences.length > 0 && (
                <div className="mt-2">
                  <div className="text-[11px] font-bold mb-1">Divergências ({lastReport.divergences.length})</div>
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-[11px]">
                      <thead className="bg-muted/40 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1 border-b">Produto</th>
                          <th className="text-left px-2 py-1 border-b">SKU</th>
                          <th className="text-left px-2 py-1 border-b">IMEI encontrado</th>
                          <th className="text-left px-2 py-1 border-b">Fonte</th>
                          <th className="text-left px-2 py-1 border-b">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastReport.divergences.slice(0, 200).map((d, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-2 py-1">{d.produto || "—"}</td>
                            <td className="px-2 py-1 font-mono">{d.sku || "—"}</td>
                            <td className="px-2 py-1 font-mono">{d.imei || "—"}</td>
                            <td className="px-2 py-1">{d.fonte}</td>
                            <td className="px-2 py-1">{d.motivo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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

function ConfRow({ label, a, c, skipCheck }: { label: string; a: number; c: number; skipCheck?: boolean }) {
  const ok = skipCheck ? true : a === c;
  return (
    <tr>
      <td className="px-2 py-1 border-b">{label}</td>
      <td className="px-2 py-1 text-right tabular-nums border-b">{a.toLocaleString("pt-BR")}</td>
      <td className="px-2 py-1 text-right tabular-nums border-b">{c.toLocaleString("pt-BR")}</td>
      <td className={`px-2 py-1 text-center border-b ${ok ? "text-emerald-600" : "text-destructive font-bold"}`}>
        {skipCheck ? "—" : ok ? "✔" : "✖"}
      </td>
    </tr>
  );
}

