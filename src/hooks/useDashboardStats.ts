 import { useState, useEffect, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { 
   startOfDay, 
   endOfDay, 
   startOfWeek, 
   startOfMonth, 
   subDays 
 } from "date-fns";
 
 export type Period = 'today' | 'week' | 'month' | 'last30';
 
 export function useDashboardStats(period: Period = 'today') {
   const { user } = useAuth();
   const [loading, setLoading] = useState(true);
   const [stats, setStats] = useState({
     todaySales: 0,
     monthRevenue: 0,
     activeOS: 0,
     lowStock: 0,
     newLeads: 0,
     avgTicket: 0
   });
 
   const fetchStats = useCallback(async () => {
     if (!user?.id) {
       setLoading(false);
       return;
     }
     
     try {
       const now = new Date();
       let startDate: Date;
       let endDate = endOfDay(now);
 
       switch (period) {
         case 'today':
           startDate = startOfDay(now);
           break;
         case 'week':
           startDate = startOfWeek(now, { weekStartsOn: 0 });
           break;
         case 'month':
           startDate = startOfMonth(now);
           break;
         case 'last30':
           startDate = startOfDay(subDays(now, 30));
           break;
         default:
           startDate = startOfDay(now);
       }
 
       const firstDayMonth = startOfMonth(now);
 
       const [salesRes, productsRes, leadsRes, osRes] = await Promise.all([
         supabase.from("sales_orders").select("total_amount, created_at, status").eq("user_id", user.id),
         supabase.from("products").select("stock_quantity, min_stock").eq("user_id", user.id),
         supabase.from("leads").select("created_at").eq("user_id", user.id),
         supabase.from("service_orders").select("status").eq("user_id", user.id),
       ]);
 
       const sales = salesRes.data || [];
       const products = productsRes.data || [];
       const leads = leadsRes.data || [];
       const os = osRes.data || [];
 
       const todaySales = sales
         .filter(s => {
           const date = new Date(s.created_at!);
           return date >= startDate && date <= endDate && s.status === 'concluded';
         })
         .reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
 
       const monthRevenue = sales
         .filter(s => new Date(s.created_at!) >= firstDayMonth && s.status === 'concluded')
         .reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
 
       const lowStockCount = products
         .filter(p => (p.stock_quantity || 0) <= (p.min_stock || 5))
         .length;
 
       const newLeadsCount = leads
         .filter(l => {
           const date = new Date(l.created_at);
           return date >= startDate && date <= endDate;
         })
         .length;
 
       const activeOSCount = os
         .filter(o => o.status !== 'delivered' && o.status !== 'canceled')
         .length;
 
       const monthSales = sales.filter(s => new Date(s.created_at!) >= firstDayMonth && s.status === 'concluded');
       const avgTicket = monthSales.length > 0 ? monthRevenue / monthSales.length : 0;
 
       setStats({
         todaySales,
         monthRevenue,
         activeOS: activeOSCount,
         lowStock: lowStockCount,
         newLeads: newLeadsCount,
         avgTicket
       });
     } catch (error) {
       console.error("Erro dashboard stats hook:", error);
     } finally {
       setLoading(false);
     }
   }, [user?.id, period]);
 
   useEffect(() => {
     fetchStats();
   }, [fetchStats]);
 
   return { stats, loading, refresh: fetchStats };
 }