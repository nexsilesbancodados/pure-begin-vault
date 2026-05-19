import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import {
  DollarSign,
  Wrench,
  Calendar,
  Star,
  Package,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface CustomerSummaryProps {
  customerId?: string | null;
  phone?: string | null;
}

type Summary = {
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  totalSpent: number;
  purchases: number;
  lastPurchase: string | null;
  openOs: number;
  totalOs: number;
  npsScore: number | null;
  pendingAmount: number;
  topProducts: string[];
  daysSinceLast: number | null;
};

export function CustomerSummary({ customerId, phone }: CustomerSummaryProps) {
  const { orgId } = useOrg();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!orgId) {
        setData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      let custId = customerId;

      if (!custId && phone) {
        let cleanPhone = String(phone).replace(/\D/g, "");
        if (cleanPhone.length === 13 && cleanPhone.startsWith("55"))
          cleanPhone = cleanPhone.slice(2);
        const last8 = cleanPhone.slice(-8);
        const { data: c } = await supabase
          .from("customers" as any)
          .select("id, name, phone, email")
          .eq("organization_id", orgId)
          .ilike("phone", `%${last8}%`)
          .limit(1)
          .maybeSingle();
        if (c) custId = (c as any).id;
      }

      if (!custId) {
        if (!cancel) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      const [custRes, salesRes, osRes, npsRes, arRes] = await Promise.all([
        supabase
          .from("customers" as any)
          .select("id, name, phone, email")
          .eq("id", custId)
          .eq("organization_id", orgId)
          .maybeSingle(),
        supabase
          .from("sales_orders")
          .select("id, total_amount, created_at, status")
          .eq("customer_id", custId)
          .eq("organization_id", orgId),
        supabase.from("service_orders").select("id, status, total_cost").eq("customer_id", custId).eq("organization_id", orgId),
        supabase
          .from("nps_responses")
          .select("score")
          .eq("customer_id", custId)
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("accounts_receivable")
          .select("amount, paid_amount, status")
          .eq("customer_id", custId)
          .eq("organization_id", orgId)
          .neq("status", "paid"),
      ]);

      const sales = ((salesRes.data ?? []) as any[]).filter((s) => s.status !== "cancelada");
      const lastSale = sales.length
        ? sales.reduce((a, b) => (new Date(a.created_at) > new Date(b.created_at) ? a : b))
        : null;
      const totalSpent = sales.reduce((a, b) => a + Number(b.total_amount ?? 0), 0);

      const os = (osRes.data ?? []) as any[];
      const openOs = os.filter(
        (o) => o.status !== "entregue" && o.status !== "concluida" && o.status !== "cancelada",
      ).length;

      const ar = (arRes.data ?? []) as any[];
      const pending = ar.reduce(
        (acc, a) => acc + (Number(a.amount ?? 0) - Number(a.paid_amount ?? 0)),
        0,
      );

      const daysSinceLast = lastSale
        ? Math.floor((Date.now() - new Date(lastSale.created_at).getTime()) / 86400000)
        : null;

      if (cancel) return;
      setData({
        customer: (custRes.data as any) ?? null,
        totalSpent,
        purchases: sales.length,
        lastPurchase: lastSale?.created_at ?? null,
        openOs,
        totalOs: os.length,
        npsScore: ((npsRes.data ?? [])[0] as any)?.score ?? null,
        pendingAmount: pending,
        topProducts: [],
        daysSinceLast,
      });
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [customerId, phone, orgId]);

  if (loading) {
    return <div className="text-xs text-muted-foreground py-2">Carregando histórico...</div>;
  }
  if (!data || !data.customer) {
    return (
      <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
        <AlertCircle className="h-3 w-3" />
        Cliente novo (sem histórico)
      </div>
    );
  }

  const c = data.customer;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black">{c.name}</h3>
          <p className="text-xs text-muted-foreground">
            {data.purchases > 0 ? `Cliente há ${data.daysSinceLast ?? 0} dias` : "Sem compras"}
          </p>
        </div>
        {data.npsScore != null && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning/10 text-warning text-xs font-bold">
            <Star className="h-3 w-3" />
            NPS {data.npsScore}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          icon={DollarSign}
          label="Total comprado"
          value={`R$ ${data.totalSpent.toFixed(0)}`}
          color="success"
        />
        <Stat icon={Package} label="Compras" value={data.purchases} color="primary" />
        <Stat
          icon={Wrench}
          label="OS em aberto"
          value={data.openOs}
          color={data.openOs > 0 ? "warning" : "primary"}
        />
        <Stat
          icon={AlertCircle}
          label="A receber"
          value={`R$ ${data.pendingAmount.toFixed(0)}`}
          color={data.pendingAmount > 0 ? "destructive" : "primary"}
        />
      </div>

      {data.daysSinceLast != null && data.daysSinceLast > 90 && (
        <div className="text-xs flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 text-warning border border-warning/30">
          <TrendingUp className="h-3 w-3" />
          Inativo há {data.daysSinceLast} dias — bom momento pra reativar
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: "primary" | "success" | "warning" | "destructive";
}) {
  const colors = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30">
      <Icon className={`h-3.5 w-3.5 ${colors[color]}`} />
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold leading-tight">
          {label}
        </div>
        <div className={`text-sm font-black ${colors[color]} leading-tight`}>{value}</div>
      </div>
    </div>
  );
}
