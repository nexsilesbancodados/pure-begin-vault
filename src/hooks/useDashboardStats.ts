import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { startOfDay, endOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";

export type Period = "today" | "week" | "month" | "last30";

const COMPLETED_STATUSES = ["completed", "concluded", "paid"];
const INACTIVE_OS_STATUSES = ["delivered", "canceled", "cancelled"];

export function useDashboardStats(period: Period = "today") {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    monthRevenue: 0,
    activeOS: 0,
    lowStock: 0,
    newLeads: 0,
    avgTicket: 0,
  });

  // Cache simples em memória por escopo (orgId | userId) — evita reload ao alternar rotas
  const cacheRef = useRef<Record<string, typeof stats>>({});
  const fetchingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    const scopeKey = orgId ?? user.id;
    // Serve cache imediatamente, atualiza em background
    if (cacheRef.current[scopeKey]) {
      setStats(cacheRef.current[scopeKey]);
      setLoading(false);
    }

    try {
      const now = new Date();
      let startDate: Date;
      const endDate = endOfDay(now);

      switch (period) {
        case "today":
          startDate = startOfDay(now);
          break;
        case "week":
          startDate = startOfWeek(now, { weekStartsOn: 0 });
          break;
        case "month":
          startDate = startOfMonth(now);
          break;
        case "last30":
          startDate = startOfDay(subDays(now, 30));
          break;
        default:
          startDate = startOfDay(now);
      }

      const firstDayMonth = startOfMonth(now);
      const scope = (q: any) =>
        orgId ? q.eq("organization_id", orgId) : q.eq("user_id", user.id);

      // Vendas: apenas as do mês (cobre "hoje" + "mês"), só campos necessários, status concluído
      const salesQ = scope(
        supabase
          .from("sales_orders")
          .select("total_amount, created_at")
          .in("status", COMPLETED_STATUSES)
          .gte("created_at", firstDayMonth.toISOString()),
      );

      // Leads: COUNT no servidor com filtro de data
      const leadsQ = scope(
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
      );

      // OS ativas: COUNT no servidor
      const osQ = scope(
        supabase
          .from("service_orders")
          .select("id", { count: "exact", head: true })
          .not("status", "in", `(${INACTIVE_OS_STATUSES.join(",")})`),
      );

      // Produtos: só os campos de estoque — sempre filtrado pela loja ativa
      // (multi-tenant: cada loja tem seu próprio estoque, nunca compartilhar)
      const productsQ = scope(
        supabase.from("products").select("stock_quantity, min_stock"),
      );

      const [salesRes, leadsRes, osRes, productsRes] = await Promise.all([
        salesQ,
        leadsQ,
        osQ,
        productsQ,
      ]);

      type SaleRow = { total_amount: number | null; created_at: string | null };
      type ProductRow = { stock_quantity: number | null; min_stock: number | null };

      const sales = (salesRes.data || []) as SaleRow[];
      const products = (productsRes.data || []) as ProductRow[];

      let todaySales = 0;
      let monthRevenue = 0;
      let monthCount = 0;
      for (const s of sales) {
        const amount = Number(s.total_amount) || 0;
        monthRevenue += amount;
        monthCount++;
        if (s.created_at) {
          const d = new Date(s.created_at);
          if (d >= startDate && d <= endDate) todaySales += amount;
        }
      }

      let lowStockCount = 0;
      for (const p of products) {
        if ((Number(p.stock_quantity) || 0) <= (Number(p.min_stock) || 5)) lowStockCount++;
      }

      const next = {
        todaySales,
        monthRevenue,
        activeOS: osRes.count ?? 0,
        lowStock: lowStockCount,
        newLeads: leadsRes.count ?? 0,
        avgTicket: monthCount > 0 ? monthRevenue / monthCount : 0,
      };

      cacheRef.current[scopeKey] = next;
      setStats(next);
    } catch (error) {
      console.error("Erro dashboard stats hook:", error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [user?.id, orgId, period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime único + debounce: 1 canal para várias tabelas, refresh agrupado a cada 1.5s
  useEffect(() => {
    if (!user?.id) return;
    const filter = orgId ? `organization_id=eq.${orgId}` : `user_id=eq.${user.id}`;
    const tables = ["sales_orders", "leads", "service_orders", "products"] as const;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        fetchStats();
      }, 1500);
    };

    const channel = supabase.channel(`dash-stats-${orgId ?? user.id}`);
    tables.forEach((t) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t, filter },
        schedule,
      );
    });
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [user?.id, orgId, fetchStats]);

  return { stats, loading, refresh: fetchStats };
}
