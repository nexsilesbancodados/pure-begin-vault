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
import { Calculator, Calendar, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export function DREConfig() {
  const { orgId } = useOrg();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState<Array<{ type: string; amount: number; category: string | null }>>(
    [],
  );

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 1).toISOString();
    (supabase as any)
      .from("finance_transactions")
      .select("type, amount, category")
      .eq("organization_id", orgId)
      .gte("transaction_date", start)
      .lt("transaction_date", end)
      .limit(10000)
      .then(({ data }: any) => {
        setTxs((data ?? []).map((t: any) => ({ ...t, amount: Number(t.amount) || 0 })));
        setLoading(false);
      });
  }, [orgId, year, month]);

  const dre = useMemo(() => {
    const grupo = (cats: string[], isIncome: boolean) => {
      return txs
        .filter((t) => {
          const matchType = isIncome
            ? t.type === "income" || t.type === "receita"
            : t.type === "expense" || t.type === "despesa";
          if (!matchType) return false;
          if (cats.length === 0) return true;
          return cats.some((c) => (t.category ?? "").toLowerCase().includes(c.toLowerCase()));
        })
        .reduce((s, t) => s + t.amount, 0);
    };
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
  }, [txs]);

  const rows = useMemo(
    () => [
      { label: "Receita Bruta de Vendas", value: dre.receitaBruta, type: "revenue" },
      { label: "(-) Impostos sobre Vendas", value: -dre.impostos, type: "expense" },
      { label: "Receita Líquida", value: dre.receitaLiquida, type: "total" },
      { label: "(-) CPV (Custo de Produtos)", value: -dre.cpv, type: "expense" },
      { label: "Lucro Bruto", value: dre.lucroBruto, type: "total" },
      { label: "(-) Despesas Operacionais", value: -dre.operacionais, type: "expense" },
      { label: "(-) Despesas Administrativas", value: -dre.administrativas, type: "expense" },
      { label: "EBITDA / LAJIDA", value: dre.ebitda, type: "total" },
      { label: "(-) Depreciação e Amortização", value: -dre.depreciacao, type: "expense" },
      { label: "Lucro Líquido do Exercício", value: dre.lucroLiquido, type: "final" },
    ],
    [dre],
  );

  const margemBruta = dre.receitaBruta > 0 ? (dre.lucroBruto / dre.receitaBruta) * 100 : 0;
  const margemLiquida = dre.receitaBruta > 0 ? (dre.lucroLiquido / dre.receitaBruta) * 100 : 0;
  const despesasFixas = dre.administrativas + dre.operacionais;

  const exportPdf = () => {
    Export.pdf(
      `DRE — ${MONTH_NAMES[month]}/${year}`,
      rows.map((r) => ({ ...r, value_formatted: BRL(r.value) })),
      [
        { key: "label", label: "Descrição" },
        { key: "value_formatted", label: "Valor (R$)" },
      ],
    );
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">DRE Gerencial</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Calculado em tempo real a partir do Fluxo de Caixa
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            ‹
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 font-bold rounded-xl">
            <Calendar className="h-4 w-4" /> {MONTH_NAMES[month]} {year}
          </Button>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            ›
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
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-5 rounded-2xl">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">
                Receita Bruta
              </div>
              <div className="text-2xl font-black text-green-600">{BRL(dre.receitaBruta)}</div>
              <div className="mt-2 text-[10px] font-bold text-muted-foreground/70">
                {txs.filter((t) => t.type === "income" || t.type === "receita").length} lançamentos
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
                {dre.receitaBruta > 0
                  ? ((despesasFixas / dre.receitaBruta) * 100).toFixed(1)
                  : "0,0"}
                % da receita
              </div>
            </Card>
            <Card className="p-5 border-none shadow-lg bg-slate-900 text-white rounded-2xl">
              <div className="text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest mb-1">
                Lucro Líquido
              </div>
              <div className={`text-2xl font-black ${dre.lucroLiquido < 0 ? "text-red-400" : ""}`}>
                {BRL(dre.lucroLiquido)}
              </div>
              <div className="mt-2 text-[10px] font-bold text-blue-400">
                Margem Líquida: {margemLiquida.toFixed(1)}%
              </div>
            </Card>
          </div>

          <Card className="rounded-2xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="text-base font-black">Demonstrativo de Resultados</CardTitle>
                <CardDescription>
                  {MONTH_NAMES[month]}/{year} · {txs.length} lançamentos
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
                        <TableCell className="px-6 py-3 text-right text-xs font-bold text-muted-foreground/70">
                          {pct.toFixed(1)}%
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
