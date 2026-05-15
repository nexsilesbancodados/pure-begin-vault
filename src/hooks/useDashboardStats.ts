import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { startOfDay, endOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";

export type Period = "today" | "week" | "month" | "last30";

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

  const fetchStats = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
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

      // Org-scoped queries when org exists; fallback to user_id otherwise
      const salesQ = orgId
        ? supabase
            .from("sales_orders")
            .select("total_amount, created_at, status")
            .eq("organization_id", orgId)
        : supabase
            .from("sales_orders")
            .select("total_amount, created_at, status")
            .eq("user_id", user.id);
      const productsQ = orgId
        ? supabase.from("products").select("stock_quantity, min_stock").eq("organization_id", orgId)
        : supabase.from("products").select("stock_quantity, min_stock").eq("user_id", user.id);
      const leadsQ = orgId
        ? supabase.from("leads").select("created_at").eq("organization_id", orgId)
        : supabase.from("leads").select("created_at").eq("user_id", user.id);
      const osQ = orgId
        ? supabase.from("service_orders").select("status").eq("organization_id", orgId)
        : supabase.from("service_orders").select("status").eq("user_id", user.id);

      const [salesRes, productsRes, leadsRes, osRes] = await Promise.all([
        salesQ,
        productsQ,
        leadsQ,
        osQ,
      ]);

      type SaleRow = { total_amount: number | null; created_at: string | null; status: string | null };
      type ProductRow = { stock_quantity: number | null; min_stock: number | null };
      type LeadRow = { created_at: string | null };
      type OSRow = { status: string | null };

      const sales = (salesRes.data || []) as SaleRow[];
      const products = (productsRes.data || []) as ProductRow[];
      const leads = (leadsRes.data || []) as LeadRow[];
      const os = (osRes.data || []) as OSRow[];

      const isCompleted = (s: string | null | undefined) =>
        s === "completed" || s === "concluded" || s === "paid";

      const todaySales = sales
        .filter((s) => {
          if (!s.created_at) return false;
          const date = new Date(s.created_at);
          return date >= startDate && date <= endDate && isCompleted(s.status);
        })
        .reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);

      const monthSales = sales.filter(
        (s) => s.created_at != null && new Date(s.created_at) >= firstDayMonth && isCompleted(s.status),
      );
      const monthRevenue = monthSales.reduce(
        (acc, curr) => acc + (Number(curr.total_amount) || 0),
        0,
      );

      const lowStockCount = products.filter(
        (p) => (Number(p.stock_quantity) || 0) <= (Number(p.min_stock) || 5),
      ).length;

      const newLeadsCount = leads.filter((l) => {
        if (!l.created_at) return false;
        const date = new Date(l.created_at);
        return date >= startDate && date <= endDate;
      }).length;

      const activeOSCount = os.filter(
        (o) => o.status !== "delivered" && o.status !== "canceled" && o.status !== "cancelled",
      ).length;

      const avgTicket = monthSales.length > 0 ? monthRevenue / monthSales.length : 0;

      setStats({
        todaySales,
        monthRevenue,
        activeOS: activeOSCount,
        lowStock: lowStockCount,
        newLeads: newLeadsCount,
        avgTicket,
      });
    } catch (error) {
      console.error("Erro dashboard stats hook:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId, period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime: refresh stats when underlying tables change
  useEffect(() => {
    if (!user?.id) return;
    const filter = orgId ? `organization_id=eq.${orgId}` : `user_id=eq.${user.id}`;
    const tables = ["sales_orders", "leads", "service_orders", "products"] as const;
    const channels = tables.map((t) =>
      supabase
        .channel(`dash-${t}-${orgId ?? user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: t, filter }, () => {
          fetchStats();
        })
        .subscribe(),
    );
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [user?.id, orgId, fetchStats]);

  return { stats, loading, refresh: fetchStats };
}
