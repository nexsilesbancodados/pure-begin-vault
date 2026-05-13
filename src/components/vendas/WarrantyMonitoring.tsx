import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, ShieldAlert, ShieldCheck, Calendar, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExportMenu } from "@/components/ui/ExportMenu";

type SaleItem = {
  id: string;
  product_name: string;
  imei: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  warranty_days: number;
  sale_date: string;
};

export function WarrantyMonitoring() {
  const { orgId } = useOrg();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "warning" | "expired">("all");

  const load = async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    // Busca itens de venda com IMEI + warranty_days. Schema pode variar
    // (sale_items pode ter snake snapshot do produto). Fallback gracioso.
    try {
      const { data: sales } = await (supabase as any)
        .from("sales_orders")
        .select(
          "id, created_at, customer_name, customer_phone, customer:customers(name, phone), items, warranty_days",
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(500);

      const flat: SaleItem[] = [];
      for (const s of sales ?? []) {
        const cust = s.customer ?? {};
        const its = Array.isArray(s.items) ? s.items : [];
        for (const it of its) {
          flat.push({
            id: `${s.id}-${it.product_id ?? it.name}`,
            product_name: it.name ?? "Produto",
            imei: it.imei ?? null,
            customer_name: s.customer_name ?? cust.name ?? "—",
            customer_phone: s.customer_phone ?? cust.phone ?? null,
            warranty_days: it.warranty_days ?? s.warranty_days ?? 90,
            sale_date: s.created_at,
          });
        }
      }
      setItems(flat);
    } catch (e) {
      console.warn(e);
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [orgId]);

  const enriched = useMemo(
    () =>
      items.map((it) => {
        const sale = new Date(it.sale_date);
        const expiry = new Date(sale);
        expiry.setDate(expiry.getDate() + (it.warranty_days ?? 90));
        const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
        const status: "active" | "warning" | "expired" =
          days < 0 ? "expired" : days <= 30 ? "warning" : "active";
        return { ...it, expiry, days, status };
      }),
    [items],
  );

  const filtered = enriched.filter((e) => {
    if (filter !== "all" && e.status !== filter) return false;
    if (!q) return true;
    return (e.product_name + (e.imei ?? "") + (e.customer_name ?? ""))
      .toLowerCase()
      .includes(q.toLowerCase());
  });

  const counts = {
    active: enriched.filter((e) => e.status === "active").length,
    warning: enriched.filter((e) => e.status === "warning").length,
    expired: enriched.filter((e) => e.status === "expired").length,
  };

  const renewMessage = (w: (typeof enriched)[0]) => {
    const phone = (w.customer_phone ?? "").replace(/\D/g, "");
    if (!phone) return alert("Cliente sem telefone");
    const msg = `Olá ${w.customer_name}, sua garantia do ${w.product_name} vence em ${w.days} dias. Que tal renovar ou levar pra revisão?`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30"
          onClick={() => setFilter(filter === "active" ? "all" : "active")}
        >
          <div className="p-3 bg-success/10 rounded-full text-success">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Ativas</p>
            <p className="text-2xl font-bold">{counts.active}</p>
          </div>
        </Card>
        <Card
          className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30"
          onClick={() => setFilter(filter === "warning" ? "all" : "warning")}
        >
          <div className="p-3 bg-warning/10 rounded-full text-warning">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Vencem em 30 dias</p>
            <p className="text-2xl font-bold">{counts.warning}</p>
          </div>
        </Card>
        <Card
          className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30"
          onClick={() => setFilter(filter === "expired" ? "all" : "expired")}
        >
          <div className="p-3 bg-destructive/10 rounded-full text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expiradas</p>
            <p className="text-2xl font-bold">{counts.expired}</p>
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar IMEI, cliente, produto..."
            className="pl-10"
          />
        </div>
        {filter !== "all" && (
          <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
            Filtro: {filter} ×
          </Button>
        )}
        <ExportMenu
          filename="garantias"
          rows={filtered}
          cols={[
            { key: "product_name", label: "Produto" },
            { key: "imei", label: "IMEI" },
            { key: "customer_name", label: "Cliente" },
            {
              key: "sale_date",
              label: "Data venda",
              format: (v) => new Date(v).toLocaleDateString("pt-BR"),
            },
            {
              key: "expiry",
              label: "Vencimento",
              format: (v) => new Date(v).toLocaleDateString("pt-BR"),
            },
            { key: "status", label: "Status" },
          ]}
        />
      </div>

      {loading ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title={items.length === 0 ? "Sem garantias ativas" : "Nenhuma garantia neste filtro"}
            description={
              items.length === 0
                ? "As garantias aparecem aqui automaticamente conforme você faz vendas no PDV com produtos."
                : "Mude o filtro pra ver outras garantias."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">
                  Produto / IMEI
                </th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">
                  Cliente
                </th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">
                  Venda
                </th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">
                  Vence em
                </th>
                <th className="text-left p-3 text-[11px] font-bold uppercase tracking-widest">
                  Status
                </th>
                <th className="text-right p-3 text-[11px] font-bold uppercase tracking-widest">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w) => (
                <tr key={w.id} className="border-b hover:bg-muted/20">
                  <td className="p-3">
                    <p className="font-bold">{w.product_name}</p>
                    {w.imei && <p className="text-xs text-muted-foreground font-mono">{w.imei}</p>}
                  </td>
                  <td className="p-3">{w.customer_name}</td>
                  <td className="p-3 text-xs">
                    {new Date(w.sale_date).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3 text-xs">{w.expiry.toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">
                    {w.status === "active" && (
                      <Badge className="bg-success/10 text-success border-success/30">Ativa</Badge>
                    )}
                    {w.status === "warning" && (
                      <Badge className="bg-warning/10 text-warning border-warning/30">
                        Vence em {w.days}d
                      </Badge>
                    )}
                    {w.status === "expired" && (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/30">
                        Expirada há {Math.abs(w.days)}d
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {w.status === "warning" && w.customer_phone && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => renewMessage(w)}
                        className="gap-1"
                      >
                        <Send className="h-3 w-3" /> WhatsApp
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
