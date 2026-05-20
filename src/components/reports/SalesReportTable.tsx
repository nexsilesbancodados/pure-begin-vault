import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { Loader2, ShoppingCart, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtNum = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface SaleRow {
  id: string;
  sale_number: number | null;
  total_amount: number;
  discount: number;
  cost: number;
  itemsCount: number;
}

interface PaymentRow {
  method: string;
  qty: number;
  amount: number;
}

const PAGE_SIZE = 10;

export const SalesReportTable: React.FC = () => {
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: salesData }, { data: itemsData }, { data: paysData }] = await Promise.all([
        supabase
          .from("sales_orders")
          .select("id, sale_number, total_amount, discount, status, created_at")
          .eq("organization_id", orgId)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("sale_items")
          .select("sale_id, quantity, unit_cost")
          .eq("organization_id", orgId)
          .limit(5000),
        supabase
          .from("sale_payments")
          .select("method, amount, sale_id")
          .eq("organization_id", orgId)
          .limit(5000),
      ]);
      if (!alive) return;

      const costMap = new Map<string, { cost: number; items: number }>();
      (itemsData ?? []).forEach((it: any) => {
        const cur = costMap.get(it.sale_id) || { cost: 0, items: 0 };
        cur.cost += Number(it.quantity || 0) * Number(it.unit_cost || 0);
        cur.items += 1;
        costMap.set(it.sale_id, cur);
      });

      const validIds = new Set((salesData ?? []).map((s: any) => s.id));
      const rows: SaleRow[] = (salesData ?? []).map((s: any) => {
        const c = costMap.get(s.id) || { cost: 0, items: 0 };
        return {
          id: s.id,
          sale_number: s.sale_number,
          total_amount: Number(s.total_amount || 0),
          discount: Number(s.discount || 0),
          cost: c.cost,
          itemsCount: c.items,
        };
      });
      setSales(rows);

      const payMap = new Map<string, { qty: Set<string>; amount: number }>();
      (paysData ?? []).forEach((p: any) => {
        if (!validIds.has(p.sale_id)) return;
        const key = (p.method || "OUTROS").toString().toUpperCase();
        const cur = payMap.get(key) || { qty: new Set(), amount: 0 };
        cur.qty.add(p.sale_id);
        cur.amount += Number(p.amount || 0);
        payMap.set(key, cur);
      });
      setPayments(
        Array.from(payMap.entries()).map(([method, v]) => ({
          method,
          qty: v.qty.size,
          amount: v.amount,
        })),
      );
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [orgId]);

  const totals = useMemo(() => {
    return sales.reduce(
      (acc, s) => {
        const profit = s.total_amount - s.cost - s.discount;
        acc.faturamento += s.total_amount;
        acc.custo += s.cost;
        acc.desconto += s.discount;
        acc.lucroTotal += profit;
        acc.lucroMedio += s.itemsCount > 0 ? profit / s.itemsCount : profit;
        return acc;
      },
      { faturamento: 0, custo: 0, desconto: 0, lucroTotal: 0, lucroMedio: 0 },
    );
  }, [sales]);

  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
  const pageRows = sales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-16 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-3" />
        <p className="text-sm font-bold">Carregando relatório de vendas…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          <h3 className="text-base font-black text-foreground">Relatório de vendas</h3>
          <span className="ml-auto text-xs font-bold text-muted-foreground">
            {sales.length} {sales.length === 1 ? "venda" : "vendas"}
          </span>
        </div>

        {sales.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-muted-foreground">
            Nenhuma venda registrada ainda.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Código da venda</th>
                    <th className="px-4 py-3 text-right">Lucro médio (R$)</th>
                    <th className="px-4 py-3 text-right">Lucro total (R$)</th>
                    <th className="px-4 py-3 text-right">Faturamento (R$)</th>
                    <th className="px-4 py-3 text-right">Percentual Lucro (%)</th>
                    <th className="px-4 py-3 text-right">Valor Custo (R$)</th>
                    <th className="px-4 py-3 text-right">Desconto (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((s) => {
                    const profit = s.total_amount - s.cost - s.discount;
                    const avg = s.itemsCount > 0 ? profit / s.itemsCount : profit;
                    const pct = s.total_amount > 0 ? (profit / s.total_amount) * 100 : 0;
                    return (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-foreground">
                          {s.sale_number ?? s.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(avg)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold">
                          {fmtNum(profit)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-primary">
                          {fmtNum(s.total_amount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-black ${pct >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                          >
                            {pct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(s.cost)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(s.discount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/30 font-black text-foreground">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtNum(totals.lucroMedio / Math.max(1, sales.length))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtNum(totals.lucroTotal)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-primary">
                      {fmtNum(totals.faturamento)}
                    </td>
                    <td className="px-4 py-3" />
                    <td className="px-4 py-3 text-right tabular-nums">{fmtNum(totals.custo)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtNum(totals.desconto)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-border flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>
                  Página {page} de {totalPages} — {sales.length} registros
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 w-8 rounded-lg border border-border flex items-center justify-center disabled:opacity-40 hover:bg-muted"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 w-8 rounded-lg border border-border flex items-center justify-center disabled:opacity-40 hover:bg-muted"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="text-base font-black text-foreground">Resumo por forma de pagamento</h3>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-sm font-bold text-muted-foreground">
            Nenhum pagamento registrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Forma de pagamento</th>
                  <th className="px-4 py-3 text-right">Quantidade em vendas</th>
                  <th className="px-4 py-3 text-right">Valor total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.method} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-foreground">{p.method}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p.qty}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-primary">
                      {fmtBRL(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-black text-foreground">
                <tr>
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {payments.reduce((s, p) => s + p.qty, 0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary">
                    {fmtBRL(paymentsTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
