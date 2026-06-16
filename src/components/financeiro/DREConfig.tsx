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

type Tx = { type: string; amount: number; category: string | null };

function computeDre(txs: Tx[]) {
  const grupo = (cats: string[], isIncome: boolean) =>
    txs
      .filter((t) => {
        const matchType = isIncome
          ? t.type === "income" || t.type === "receita"
          : t.type === "expense" || t.type === "despesa";
        if (!matchType) return false;
        if (cats.length === 0) return true;
        return cats.some((c) => (t.category ?? "").toLowerCase().includes(c.toLowerCase()));
      })
      .reduce((s, t) => s + t.amount, 0);

  const receitaBruta = grupo([], true);
  const impostos = grupo(["imposto"], false);
  const receitaLiquida = receitaBruta - impostos;
  const cpv = grupo(["custo", "cmv", "cpv", "estoque", "compra"], false);
  const lucroBruto = receitaLiquida - cpv;
  const operacionais = grupo(["operacional", "marketing", "comissao", "frete"], false);
  const administrativas = grupo(
    ["administrativ", "aluguel", "salario", "luz", "internet", "telefone"],
    false,
  );
  const ebitda = lucroBruto - operacionais - administrativas;
  const depreciacao = grupo(["depreciacao", "amortizacao"], false);
  const lucroLiquido = ebitda - depreciacao;
  return {
    receitaBruta,
    impostos,
    receitaLiquida,
    cpv,
    lucroBruto,
    operacionais,
    administrativas,
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
    ]).then(([cur, prev]: any) => {
      const norm = (data: any) =>
        (data ?? []).map((t: any) => ({ ...t, amount: Number(t.amount) || 0 }));
      setTxs(norm(cur.data));
      setPrevTxs(norm(prev.data));
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
        </>
      )}
    </div>
  );
}
