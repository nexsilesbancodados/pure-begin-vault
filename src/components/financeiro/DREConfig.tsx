import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calculator,
  Calendar,
  Download,
  Loader2,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { Link } from "@tanstack/react-router";
import { Export } from "@/lib/exportUniversal";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

type Tx = {
  id?: string | null;
  source?: "finance_transactions" | "accounts_payable" | "accounts_receivable";
  type: string;
  amount: number;
  category: string | null;
  description?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
  import_job_id?: string | null;
  transaction_date?: string | null;
};

const asArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);
const toAmount = (value: unknown) => Math.abs(Number(value) || 0);
const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const isIncomeTx = (t: Tx) => normalizeText(t.type) === "income" || normalizeText(t.type) === "receita";
const isExpenseTx = (t: Tx) => normalizeText(t.type) === "expense" || normalizeText(t.type) === "despesa";
const includesAny = (t: Tx, terms: string[]) => {
  const text = normalizeText(`${t.category ?? ""} ${t.description ?? ""}`);
  return terms.some((term) => text.includes(normalizeText(term)));
};

function uniqueDreRows(rows: Tx[]) {
  const seenRef = new Set<string>();
  const seenBusiness = new Set<string>();

  return asArray(rows).filter((row) => {
    if (!row || (!isIncomeTx(row) && !isExpenseTx(row))) return false;
    const amount = Math.round(toAmount(row.amount) * 100);
    if (amount <= 0) return false;

    const type = isIncomeTx(row) ? "income" : "expense";
    const refType = normalizeText(row.reference_type);
    const refId = String(row.reference_id ?? "").trim();
    if (refId) {
      const refKey = `${type}|${refType}|${refId}`;
      if (seenRef.has(refKey)) return false;
      seenRef.add(refKey);
    }

    const dateKey = row.transaction_date ? new Date(row.transaction_date).toISOString().slice(0, 10) : "sem-data";
    const businessKey = [
      type,
      amount,
      dateKey,
      normalizeText(row.category),
      normalizeText(row.description),
    ].join("|");
    if (seenBusiness.has(businessKey)) return false;
    seenBusiness.add(businessKey);
    return true;
  });
}

function classifyExpense(t: Tx) {
  if (includesAny(t, ["imposto", "tributo", "simples", "darf", "icms", "iss", "pis", "cofins"])) return "impostos";
  if (includesAny(t, ["custo", "cmv", "cpv", "estoque", "compra", "mercadoria", "produto", "aparelho"])) return "cpv";
  if (includesAny(t, ["depreciacao", "amortizacao"])) return "depreciacao";
  if (includesAny(t, ["administrativ", "aluguel", "salario", "salarios", "folha", "energia", "luz", "agua", "internet", "telefone", "contador", "software", "saas", "taxa", "tarifa", "bancaria", "pro-labore"])) return "administrativas";
  if (includesAny(t, ["operacional", "marketing", "comissao", "comissoes", "frete", "logistica", "transporte", "entrega", "manutencao", "material"])) return "operacionais";
  return "outras";
}

function computeDre(txs: Tx[]) {
  const safeTxs = uniqueDreRows(asArray(txs));
  const receitaBruta = safeTxs.filter(isIncomeTx).reduce((s, t) => s + toAmount(t.amount), 0);
  const expenseBuckets = {
    impostos: 0,
    cpv: 0,
    operacionais: 0,
    administrativas: 0,
    depreciacao: 0,
    outras: 0,
  };

  for (const tx of safeTxs.filter(isExpenseTx)) {
    expenseBuckets[classifyExpense(tx)] += toAmount(tx.amount);
  }

  const { impostos, cpv, operacionais, administrativas, depreciacao, outras } = expenseBuckets;
  const totalDespesas = impostos + cpv + operacionais + administrativas + depreciacao + outras;
  const receitaLiquida = receitaBruta - impostos;
  const lucroBruto = receitaLiquida - cpv;
  const ebitda = lucroBruto - operacionais - administrativas - outras;
  const lucroLiquido = receitaBruta - totalDespesas;

  return {
    receitaBruta,
    totalDespesas,
    impostos,
    receitaLiquida,
    cpv,
    lucroBruto,
    operacionais,
    administrativas,
    outras,
    ebitda,
    depreciacao,
    lucroLiquido,
  };
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  const diff = current - previous;
  const pct = previous === 0 ? 100 : (diff / Math.abs(previous)) * 100;
  const positive = diff >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold ${positive ? "text-green-600" : "text-red-600"}`}
    >
      <Icon className="h-3 w-3" />
      {positive ? "+" : ""}
      {pct.toFixed(1)}% vs mês ant.
    </span>
  );
}

export function DREConfig() {
  const { orgId } = useOrg();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [prevTxs, setPrevTxs] = useState<Tx[]>([]);
  const [yearTxs, setYearTxs] = useState<(Tx & { transaction_date: string })[]>([]);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 1).toISOString();
    const prevStart = new Date(year, month - 1, 1).toISOString();
    const prevEnd = start;
    const yearStart = new Date(year, 0, 1).toISOString();
    const yearEnd = new Date(year + 1, 0, 1).toISOString();
    Promise.all([
      (supabase as any)
        .from("finance_transactions")
        .select("type, amount, category")
        .eq("organization_id", orgId)
        .gte("transaction_date", start)
        .lt("transaction_date", end)
        .limit(10000),
      (supabase as any)
        .from("finance_transactions")
        .select("type, amount, category")
        .eq("organization_id", orgId)
        .gte("transaction_date", prevStart)
        .lt("transaction_date", prevEnd)
        .limit(10000),
      (supabase as any)
        .from("finance_transactions")
        .select("type, amount, category, transaction_date")
        .eq("organization_id", orgId)
        .gte("transaction_date", yearStart)
        .lt("transaction_date", yearEnd)
        .limit(50000),
    ]).then(([cur, prev, yr]: any) => {
      const norm = (data: any) =>
        (data ?? []).map((t: any) => ({ ...t, amount: Number(t.amount) || 0 }));
      setTxs(norm(cur.data));
      setPrevTxs(norm(prev.data));
      setYearTxs(norm(yr.data));
      setLoading(false);
    });
  }, [orgId, year, month]);

  const dre = useMemo(() => computeDre(txs), [txs]);
  const prevDre = useMemo(() => computeDre(prevTxs), [prevTxs]);

  const rows = useMemo(
    () => [
      { label: "Receita Bruta de Vendas", value: dre.receitaBruta, prev: prevDre.receitaBruta, type: "revenue" },
      { label: "(-) Impostos sobre Vendas", value: -dre.impostos, prev: -prevDre.impostos, type: "expense" },
      { label: "Receita Líquida", value: dre.receitaLiquida, prev: prevDre.receitaLiquida, type: "total" },
      { label: "(-) CPV (Custo de Produtos)", value: -dre.cpv, prev: -prevDre.cpv, type: "expense" },
      { label: "Lucro Bruto", value: dre.lucroBruto, prev: prevDre.lucroBruto, type: "total" },
      { label: "(-) Despesas Operacionais", value: -dre.operacionais, prev: -prevDre.operacionais, type: "expense" },
      { label: "(-) Despesas Administrativas", value: -dre.administrativas, prev: -prevDre.administrativas, type: "expense" },
      { label: "(-) Outras Despesas", value: -dre.outras, prev: -prevDre.outras, type: "expense" },
      { label: "EBITDA / LAJIDA", value: dre.ebitda, prev: prevDre.ebitda, type: "total" },
      { label: "(-) Depreciação e Amortização", value: -dre.depreciacao, prev: -prevDre.depreciacao, type: "expense" },
      { label: "Lucro Líquido do Exercício", value: dre.lucroLiquido, prev: prevDre.lucroLiquido, type: "final" },
    ],
    [dre, prevDre],
  );

  const margemBruta = dre.receitaBruta > 0 ? (dre.lucroBruto / dre.receitaBruta) * 100 : 0;
  const margemLiquida = dre.receitaBruta > 0 ? (dre.lucroLiquido / dre.receitaBruta) * 100 : 0;
  const despesasFixas = dre.administrativas + dre.operacionais;
  const breakeven = margemBruta > 0 ? (despesasFixas / (margemBruta / 100)) : 0;

  const monthly = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      mes: MONTH_NAMES[i].slice(0, 3),
      idx: i,
      receita: 0,
      despesa: 0,
      lucro: 0,
    }));
    for (const t of yearTxs) {
      const d = new Date(t.transaction_date);
      if (d.getFullYear() !== year) continue;
      const b = buckets[d.getMonth()];
      if (!b) continue;
      if (t.type === "income" || t.type === "receita") b.receita += t.amount;
      else if (t.type === "expense" || t.type === "despesa") b.despesa += t.amount;
    }
    buckets.forEach((b) => (b.lucro = b.receita - b.despesa));
    return buckets;
  }, [yearTxs, year]);

  const ytd = useMemo(() => {
    let receita = 0,
      despesa = 0;
    for (const b of monthly) {
      if (b.idx > month) break;
      receita += b.receita;
      despesa += b.despesa;
    }
    return { receita, despesa, lucro: receita - despesa };
  }, [monthly, month]);

  const exportRows = () =>
    rows.map((r) => ({
      ...r,
      value_formatted: BRL(r.value),
      prev_formatted: BRL(r.prev),
      pct:
        dre.receitaBruta > 0
          ? ((Math.abs(r.value) / dre.receitaBruta) * 100).toFixed(1) + "%"
          : "0%",
    }));

  const cols = [
    { key: "label" as const, label: "Descrição" },
    { key: "value_formatted" as const, label: "Valor (R$)" },
    { key: "prev_formatted" as const, label: "Mês Ant. (R$)" },
    { key: "pct" as const, label: "% Receita" },
  ];

  const exportPdf = () =>
    Export.pdf(`DRE — ${MONTH_NAMES[month]}/${year}`, exportRows(), cols);
  const exportExcel = () =>
    Export.excel(`dre-${year}-${String(month + 1).padStart(2, "0")}`, exportRows(), cols);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  const isEmpty = !loading && txs.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">DRE Gerencial</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Calculado em tempo real a partir do Fluxo de Caixa
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button variant="outline" size="sm" onClick={prevMonth} aria-label="Mês anterior">
            ‹
          </Button>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-9 w-[130px] rounded-xl font-bold">
              <Calendar className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-[100px] rounded-xl font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={nextMonth} aria-label="Próximo mês">
            ›
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            className="h-9 gap-2 font-bold rounded-xl"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportPdf}
            className="h-9 gap-2 font-bold rounded-xl"
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </Card>
      ) : isEmpty ? (
        <Card className="p-12 text-center space-y-2">
          <Calculator className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-bold">Sem lançamentos em {MONTH_NAMES[month]}/{year}</p>
          <p className="text-sm text-muted-foreground">
            Registre receitas e despesas no Fluxo de Caixa para ver o DRE.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 rounded-2xl">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Receita Bruta
              </div>
              <div className="text-2xl font-black text-green-600">{BRL(dre.receitaBruta)}</div>
              <div className="mt-2">
                <Delta current={dre.receitaBruta} previous={prevDre.receitaBruta} />
              </div>
            </Card>
            <Card className="p-5 rounded-2xl">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Margem Bruta
              </div>
              <div className="text-2xl font-black">{margemBruta.toFixed(1)}%</div>
              <div className="mt-2 text-[10px] font-bold text-muted-foreground/70">
                Lucro Bruto: {BRL(dre.lucroBruto)}
              </div>
            </Card>
            <Card className="p-5 rounded-2xl">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Despesas Fixas
              </div>
              <div className="text-2xl font-black text-red-600">{BRL(despesasFixas)}</div>
              <div className="mt-2 text-[10px] font-bold text-muted-foreground/70">
                Ponto de equilíbrio: {BRL(breakeven)}
              </div>
            </Card>
            <Card className="p-5 border-none shadow-lg bg-slate-900 text-white rounded-2xl">
              <div className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">
                Lucro Líquido
              </div>
              <div className={`text-2xl font-black ${dre.lucroLiquido < 0 ? "text-red-400" : "text-green-400"}`}>
                {BRL(dre.lucroLiquido)}
              </div>
              <div className="mt-2 text-[10px] font-bold text-blue-300">
                Margem Líquida: {margemLiquida.toFixed(1)}%
              </div>
            </Card>
          </div>

          <Card className="rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="text-base font-black">Demonstrativo de Resultados</CardTitle>
                <CardDescription>
                  {MONTH_NAMES[month]}/{year} · {txs.length} lançamentos · comparado com{" "}
                  {MONTH_NAMES[(month + 11) % 12]}
                </CardDescription>
              </div>
              <Link to="/financeiro/plano-contas">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-[10px] font-black uppercase rounded-lg"
                >
                  <Calculator className="h-3 w-3" /> Plano de Contas
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 dark:bg-slate-900/50">
                    <TableHead className="px-6 py-3 text-[10px] font-black uppercase tracking-widest">
                      Descrição
                    </TableHead>
                    <TableHead className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-right">
                      Valor
                    </TableHead>
                    <TableHead className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-right hidden md:table-cell">
                      Mês Ant.
                    </TableHead>
                    <TableHead className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-right hidden sm:table-cell">
                      Δ
                    </TableHead>
                    <TableHead className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-right">
                      % Receita
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((item, idx) => {
                    const pct =
                      dre.receitaBruta > 0 ? (Math.abs(item.value) / dre.receitaBruta) * 100 : 0;
                    return (
                      <TableRow
                        key={idx}
                        className={`${item.type === "total" ? "bg-muted/40 dark:bg-slate-900/50 font-bold" : ""} ${item.type === "final" ? "bg-muted/80 dark:bg-slate-800/80 font-black" : ""}`}
                      >
                        <TableCell className="px-6 py-3 text-sm">{item.label}</TableCell>
                        <TableCell
                          className={`px-6 py-3 text-right text-sm font-bold ${item.value < 0 ? "text-red-600" : item.type === "revenue" || item.type === "final" || item.type === "total" ? "text-green-600" : ""}`}
                        >
                          {BRL(item.value)}
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right text-xs text-muted-foreground hidden md:table-cell">
                          {BRL(item.prev)}
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right hidden sm:table-cell">
                          <Delta current={item.value} previous={item.prev} />
                        </TableCell>
                        <TableCell className="px-6 py-3 text-right text-xs font-bold text-muted-foreground/70">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden hidden lg:block">
                              <div
                                className={`h-full ${item.value < 0 ? "bg-red-500" : "bg-green-500"}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            {pct.toFixed(1)}%
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 rounded-2xl">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base font-black">Evolução do Ano · {year}</CardTitle>
                <CardDescription>Receita, despesa e lucro mês a mês</CardDescription>
              </CardHeader>
              <CardContent className="p-4">
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                        }
                      />
                      <Tooltip
                        formatter={(v: any) => BRL(Number(v))}
                        contentStyle={{ borderRadius: 12, fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="receita" name="Receita" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="despesa" name="Despesa" fill="hsl(0 84% 60%)" radius={[6, 6, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="lucro"
                        name="Lucro"
                        stroke="hsl(217 91% 60%)"
                        strokeWidth={3}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base font-black">Acumulado do Ano (YTD)</CardTitle>
                <CardDescription>Janeiro até {MONTH_NAMES[month]}</CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div>
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Receita acumulada
                  </div>
                  <div className="text-xl font-black text-green-600">{BRL(ytd.receita)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Despesa acumulada
                  </div>
                  <div className="text-xl font-black text-red-600">{BRL(ytd.despesa)}</div>
                </div>
                <div className="pt-3 border-t">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Resultado YTD
                  </div>
                  <div
                    className={`text-2xl font-black ${ytd.lucro < 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {BRL(ytd.lucro)}
                  </div>
                  <div className="mt-1 text-[10px] font-bold text-muted-foreground/70">
                    Margem:{" "}
                    {ytd.receita > 0 ? ((ytd.lucro / ytd.receita) * 100).toFixed(1) : "0.0"}%
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
