import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { HubHero } from "@/components/layout/HubHero";
import { ImportCsvDialog } from "@/components/customers/ImportCsvDialog";
import {
  Users,
  Plus,
  MoreVertical,
  Search,
  Loader2,
  Trash2,
  Edit3,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Wrench,
  X,
  Upload,
  Download,
  History,
  MessageCircle,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function avatarGradient(name: string) {
  const palettes = [
    "from-[oklch(0.6_0.2_255)] to-[oklch(0.55_0.22_220)]",
    "from-[oklch(0.6_0.2_295)] to-[oklch(0.55_0.22_255)]",
    "from-[oklch(0.65_0.18_180)] to-[oklch(0.55_0.2_220)]",
    "from-[oklch(0.65_0.2_25)] to-[oklch(0.6_0.22_15)]",
    "from-[oklch(0.65_0.18_140)] to-[oklch(0.55_0.2_180)]",
    "from-[oklch(0.65_0.2_70)] to-[oklch(0.6_0.22_30)]",
  ];
  const idx = (name?.charCodeAt(0) ?? 0) % palettes.length;
  return palettes[idx];
}
function initialsFor(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}
function customerCode(c: { id?: string | null }) {
  const id = String(c?.id ?? "");
  return id ? `CLI-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}` : "—";
}

type ContactFilter = "all" | "whatsapp" | "email" | "incomplete";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — ConectaCRM" },
      { name: "description", content: "Gerencie sua base de clientes." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [sortBy, setSortBy] = useState<"name" | "top">("name");
  const [purchaseStats, setPurchaseStats] = useState<Record<string, { total: number; count: number }>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<{ sales: any[]; services: any[] }>({
    sales: [],
    services: [],
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<any | null>(null);
  const [viewingDetails, setViewingDetails] = useState<{
    devices: Array<{ id: string; name: string; qty: number; total: number; date: string; imei?: string }>;
    transfers: Array<{ id: string; description: string; amount: number; date: string; method?: string }>;
    loading: boolean;
  }>({ devices: [], transfers: [], loading: false });

  useEffect(() => {
    if (!viewingCustomer?.id || !orgId) return;
    let cancelled = false;
    setViewingDetails({ devices: [], transfers: [], loading: true });
    (async () => {
      try {
        const [salesRes, ftRes] = await Promise.all([
          supabase
            .from("sales_orders")
            .select("id, created_at, sale_items(product_name, quantity, total, imei)")
            .eq("customer_id", viewingCustomer.id)
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
          supabase
            .from("finance_transactions")
            .select("id, description, amount, transaction_date, payment_method, type")
            .eq("organization_id", orgId)
            .or(`description.ilike.%${viewingCustomer.name}%`)
            .order("transaction_date", { ascending: false })
            .limit(20),
        ]);
        if (cancelled) return;
        const devices: any[] = [];
        (salesRes.data || []).forEach((s: any) => {
          (s.sale_items || []).forEach((it: any, idx: number) => {
            devices.push({
              id: `${s.id}-${idx}`,
              name: it.product_name,
              qty: Number(it.quantity || 0),
              total: Number(it.total || 0),
              date: s.created_at,
              imei: it.imei,
            });
          });
        });
        const transfers = (ftRes.data || []).map((t: any) => ({
          id: t.id,
          description: t.description || t.type,
          amount: Number(t.amount || 0),
          date: t.transaction_date,
          method: t.payment_method,
        }));
        setViewingDetails({ devices, transfers, loading: false });
      } catch {
        if (!cancelled) setViewingDetails({ devices: [], transfers: [], loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewingCustomer?.id, orgId]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    address: "",
    city: "",
    state: "",
  });

  const fetchCustomers = useCallback(async () => {
    if (!user?.id || !orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("organization_id", orgId)
        .order("name", { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast.error("Erro ao carregar base de clientes.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("customer_id, total_amount")
        .eq("organization_id", orgId)
        .not("customer_id", "is", null);
      if (cancelled) return;
      const agg: Record<string, { total: number; count: number }> = {};
      (data || []).forEach((s: any) => {
        const id = s.customer_id as string;
        if (!agg[id]) agg[id] = { total: 0, count: 0 };
        agg[id].total += Number(s.total_amount || 0);
        agg[id].count += 1;
      });
      setPurchaseStats(agg);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, customers.length]);

  const handleOpenModal = (customer?: any) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        email: customer.email || "",
        phone: customer.phone || "",
        document: customer.document || "",
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        document: "",
        address: "",
        city: "",
        state: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user?.id || !orgId || !formData.name) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        organization_id: orgId,
        ...formData,
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomer.id)
          .eq("organization_id", orgId);
        if (error) throw error;
        toast.success("Cliente atualizado!");
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
        toast.success("Cliente cadastrado!");
      }

      setIsModalOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cliente permanentemente?")) return;
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq("organization_id", orgId);
      if (error) throw error;
      toast.success("Cliente removido.");
      fetchCustomers();
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  };

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = customers.filter((c) => {
      const name = String(c.name ?? "").toLowerCase();
      const email = String(c.email ?? "").toLowerCase();
      const phone = String(c.phone ?? "");
      const document = String(c.document ?? "").toLowerCase();
      const matchesSearch =
        !term || name.includes(term) || email.includes(term) || phone.includes(term) || document.includes(term);
      const matchesFilter =
        contactFilter === "all" ||
        (contactFilter === "whatsapp" && !!c.phone) ||
        (contactFilter === "email" && !!c.email) ||
        (contactFilter === "incomplete" && (!c.phone || !c.email));
      return matchesSearch && matchesFilter;
    });
    if (sortBy === "top") {
      return [...list].sort((a, b) => {
        const ta = purchaseStats[a.id]?.total ?? 0;
        const tb = purchaseStats[b.id]?.total ?? 0;
        if (tb !== ta) return tb - ta;
        return (purchaseStats[b.id]?.count ?? 0) - (purchaseStats[a.id]?.count ?? 0);
      });
    }
    return list;
  }, [customers, searchTerm, contactFilter, sortBy, purchaseStats]);

  const stats = useMemo(() => {
    const now = Date.now();
    const monthAgo = now - 30 * 86400000;
    return {
      total: customers.length,
      newMonth: customers.filter(
        (c) => c.created_at && new Date(c.created_at).getTime() > monthAgo,
      ).length,
      withWhatsapp: customers.filter((c) => !!c.phone).length,
      withEmail: customers.filter((c) => !!c.email).length,
    };
  }, [customers]);

  const fetchCustomerHistory = async (customerId: string) => {
    setLoadingHistory(true);
    try {
      const [salesRes, servicesRes] = await Promise.all([
        supabase
          .from("sales_orders")
          .select("*")
          .eq("customer_id", customerId)
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
        supabase
          .from("service_orders")
          .select("*")
          .eq("customer_id", customerId)
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false }),
      ]);
      setCustomerHistory({
        sales: (salesRes.data || []).map((s: any) => ({ ...s, total_amount: s.total_amount || 0 })),
        services: servicesRes.data || [],
      });
    } catch (error) {
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewHistory = (customer: any) => {
    setEditingCustomer(customer);
    fetchCustomerHistory(customer.id);
    setIsHistoryOpen(true);
  };

  const filterOptions: Array<{ value: ContactFilter; label: string; count: number }> = [
    { value: "all", label: "Todos", count: customers.length },
    { value: "whatsapp", label: "WhatsApp", count: stats.withWhatsapp },
    { value: "email", label: "E-mail", count: stats.withEmail },
    {
      value: "incomplete",
      label: "Incompletos",
      count: customers.filter((c) => !c.phone || !c.email).length,
    },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Dialog open={!!viewingCustomer} onOpenChange={(o) => !o && setViewingCustomer(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div
                className={cn(
                  "h-12 w-12 rounded-full bg-gradient-to-br text-white grid place-items-center font-black text-sm shrink-0",
                  avatarGradient(viewingCustomer?.name ?? ""),
                )}
              >
                {initialsFor(viewingCustomer?.name)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="truncate">{viewingCustomer?.name}</span>
                {viewingCustomer && (
                  <span className="text-[10px] font-mono font-bold text-muted-foreground tracking-wider">
                    {customerCode(viewingCustomer)}
                  </span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewingCustomer && (
            <div className="space-y-3 py-2 text-sm">
              {[
                { icon: Phone, label: "WhatsApp / Telefone", value: viewingCustomer.phone },
                { icon: Mail, label: "E-mail", value: viewingCustomer.email },
                { icon: Users, label: "CPF / CNPJ", value: viewingCustomer.document },
                {
                  icon: MapPin,
                  label: "Endereço",
                  value: [viewingCustomer.address, viewingCustomer.city, viewingCustomer.state]
                    .filter(Boolean)
                    .join(", "),
                },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/30"
                >
                  <f.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      {f.label}
                    </div>
                    <div className="font-semibold text-foreground break-words">
                      {f.value || "—"}
                    </div>
                  </div>
                </div>
              ))}

              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-2">
                  <Wrench className="h-3 w-3" /> Aparelhos comprados
                </div>
                {viewingDetails.loading ? (
                  <div className="text-xs text-muted-foreground italic px-3 py-2">Carregando...</div>
                ) : viewingDetails.devices.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic px-3 py-2">
                    Nenhum aparelho comprado.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {viewingDetails.devices.map((d) => (
                      <div
                        key={d.id}
                        className="text-xs p-2.5 rounded-lg border border-border bg-muted/30 flex justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">{d.name}</div>
                          <div className="text-muted-foreground text-[10px]">
                            {new Date(d.date).toLocaleDateString("pt-BR")} · Qtd {d.qty}
                            {d.imei ? ` · IMEI ${d.imei}` : ""}
                          </div>
                        </div>
                        <div className="font-black shrink-0">
                          R$ {d.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-3 w-3" /> Transferências / Pagamentos
                </div>
                {viewingDetails.loading ? (
                  <div className="text-xs text-muted-foreground italic px-3 py-2">Carregando...</div>
                ) : viewingDetails.transfers.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic px-3 py-2">
                    Nenhuma transferência registrada.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {viewingDetails.transfers.map((t) => (
                      <div
                        key={t.id}
                        className="text-xs p-2.5 rounded-lg border border-border bg-muted/30 flex justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">{t.description}</div>
                          <div className="text-muted-foreground text-[10px]">
                            {new Date(t.date).toLocaleDateString("pt-BR")}
                            {t.method ? ` · ${t.method}` : ""}
                          </div>
                        </div>
                        <div className="font-black shrink-0">
                          R$ {t.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {viewingCustomer.created_at && (
                <div className="text-xs text-muted-foreground text-center pt-2">
                  Cliente desde{" "}
                  {new Date(viewingCustomer.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const c = viewingCustomer;
                setViewingCustomer(null);
                if (c) handleViewHistory(c);
              }}
            >
              <History className="h-4 w-4 mr-2" /> Histórico
            </Button>
            <Button
              onClick={() => {
                const c = viewingCustomer;
                setViewingCustomer(null);
                if (c) handleOpenModal(c);
              }}
            >
              <Edit3 className="h-4 w-4 mr-2" /> Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico: {editingCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-success" /> Vendas Recentes
                  </h3>
                  {customerHistory.sales.length > 0 ? (
                    <div className="space-y-2">
                      {customerHistory.sales.map((s) => (
                        <div
                          key={s.id}
                          className="text-xs p-3 rounded-xl border border-border bg-muted/40 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-bold">Venda #{s.id.slice(0, 8)}</div>
                            <div className="text-muted-foreground">
                              {new Date(s.created_at).toLocaleDateString("pt-BR")}
                            </div>
                          </div>
                          <div className="font-black text-foreground">
                            R$ {s.total_amount.toLocaleString("pt-BR")}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic px-3">
                      Nenhuma venda registrada.
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" /> Ordens de Serviço
                  </h3>
                  {customerHistory.services.length > 0 ? (
                    <div className="space-y-2">
                      {customerHistory.services.map((s) => (
                        <div
                          key={s.id}
                          className="text-xs p-3 rounded-xl border border-border bg-muted/40 flex justify-between items-center"
                        >
                          <div>
                            <div className="font-bold">{s.equipment}</div>
                            <div className="text-muted-foreground">
                              {new Date(s.created_at).toLocaleDateString("pt-BR")} - {s.status}
                            </div>
                          </div>
                          <div className="font-black text-foreground">
                            R$ {(s.estimated_cost || 0).toLocaleString("pt-BR")}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic px-3">
                      Nenhum serviço registrado.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: João da Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="joao@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp / Celular</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document">CPF / CNPJ</Label>
              <Input
                id="document"
                value={formData.document}
                onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="street">Endereço (Rua)</Label>
                <Input
                  id="street"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportCsvDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImported={() => fetchCustomers()}
      />

      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Base de Clientes" subtitle="Gestão centralizada de contatos" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <HubHero
            eyebrow="Clientes"
            icon={Users}
            title="Sua base, organizada e ativa"
            description="Cadastre, segmente e converse com seus clientes. Acompanhe o histórico de vendas e ordens de serviço em um só lugar."
            actions={[
              {
                label: "Novo Cliente",
                onClick: () => setIsQuickAddOpen(true),
                icon: UserPlus,
              },
              {
                label: "Importar CSV",
                onClick: () => setIsImportOpen(true),
                icon: Upload,
                variant: "ghost",
              },
            ]}
          />

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total", value: stats.total, icon: Users, tone: "primary" as const },
              { label: "Novos no Mês", value: stats.newMonth, icon: Sparkles, tone: "success" as const },
              { label: "Com WhatsApp", value: stats.withWhatsapp, icon: MessageCircle, tone: "info" as const },
              { label: "Com E-mail", value: stats.withEmail, icon: Mail, tone: "warning" as const },
            ].map((s) => (
              <div
                key={s.label}
                className="group relative overflow-hidden rounded-2xl bg-card border border-border p-4 shadow-card transition-all hover:shadow-elegant hover:-translate-y-0.5"
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-50 transition-opacity group-hover:opacity-80",
                    s.tone === "primary" && "bg-primary/30",
                    s.tone === "success" && "bg-success/30",
                    s.tone === "info" && "bg-info/30",
                    s.tone === "warning" && "bg-warning/30",
                  )}
                />
                <div className="relative flex items-center gap-3">
                  <div
                    className={cn(
                      "h-11 w-11 rounded-xl grid place-items-center ring-1 ring-inset",
                      s.tone === "primary" && "bg-primary/10 text-primary ring-primary/20",
                      s.tone === "success" && "bg-success/10 text-success ring-success/20",
                      s.tone === "info" && "bg-info/10 text-info ring-info/20",
                      s.tone === "warning" && "bg-warning/10 text-warning ring-warning/20",
                    )}
                  >
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-black tracking-tight font-display tabular-nums">
                      {s.value}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                      {s.label}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Add Section */}
          <div
            className={cn(
              "transition-all duration-300 overflow-hidden",
              isQuickAddOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="bg-gradient-card-blue border border-primary/20 rounded-2xl p-6 shadow-blue">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                  <Plus className="h-4 w-4" /> Cadastro Rápido de Cliente
                </h3>
                <button
                  onClick={() => setIsQuickAddOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                    Nome Completo
                  </Label>
                  <Input
                    placeholder="Nome do cliente..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-card h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                    WhatsApp / Telefone
                  </Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-card h-11"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 h-11 font-bold bg-gradient-primary hover:opacity-95 shadow-blue"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Cadastrar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleOpenModal()}
                    className="h-11 px-4"
                  >
                    Completo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3 flex-1">
              <div className="relative flex-1 md:max-w-md">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Buscar por nome, email ou telefone..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border outline-none text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              </div>
              <div className="flex gap-1 rounded-xl border border-border bg-card p-1 overflow-x-auto">
                {filterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setContactFilter(option.value)}
                    className={cn(
                      "h-8 shrink-0 rounded-lg px-3 text-xs font-bold transition-colors",
                      contactFilter === option.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {option.label} <span className="tabular-nums opacity-80">{option.count}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
                <button
                  onClick={() => setSortBy("name")}
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-3 text-xs font-bold transition-colors",
                    sortBy === "name"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  A–Z
                </button>
                <button
                  onClick={() => setSortBy("top")}
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-3 text-xs font-bold transition-colors flex items-center gap-1",
                    sortBy === "top"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  title="Quem mais comprou"
                >
                  <Sparkles className="h-3 w-3" /> Top compradores
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsImportOpen(true)}
                className="h-10 px-4 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-muted transition flex items-center gap-2"
              >
                <Upload className="h-4 w-4" /> Importar
              </button>
              <button
                onClick={() => {
                  import("@/lib/exportCsv").then(({ exportToCsv }) => {
                    exportToCsv(
                      "clientes.csv",
                      customers.map((c) => ({
                        nome: c.name,
                        email: c.email,
                        telefone: c.phone,
                        documento: c.document,
                        cidade: c.city,
                        estado: c.state,
                        criado_em: c.created_at,
                      })),
                    );
                  });
                }}
                className="h-10 px-4 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-muted transition flex items-center gap-2"
              >
                <Download className="h-4 w-4" /> Exportar
              </button>
              <button
                onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                className={cn(
                  "h-10 px-4 rounded-xl text-sm font-bold transition flex items-center gap-2",
                  isQuickAddOpen
                    ? "bg-muted text-foreground hover:bg-muted/80"
                    : "bg-gradient-primary text-white hover:opacity-95 hover:scale-[1.02] active:scale-95 shadow-blue",
                )}
              >
                <Plus className="h-4 w-4" /> Novo Cliente
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Cliente", "Contato", "Localização", "CPF/CNPJ", ""].map((h, i) => (
                      <th
                        key={h + i}
                        className={cn(
                          "px-5 py-3.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest",
                          i === 4 && "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-muted-foreground mt-2 text-sm">
                          Carregando clientes...
                        </p>
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto mb-4 ring-1 ring-inset ring-primary/20">
                          <Users className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-black font-display">
                          Nenhum cliente encontrado
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                          Cadastre seu primeiro cliente ou importe sua base por CSV.
                        </p>
                        <button
                          onClick={() => setIsQuickAddOpen(true)}
                          className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-primary text-white text-sm font-bold shadow-blue hover:opacity-95 transition"
                        >
                          <Plus className="h-4 w-4" /> Cadastrar Cliente
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const isNew =
                        customer.created_at &&
                        Date.now() - new Date(customer.created_at).getTime() < 7 * 86400000;
                      return (
                        <tr
                          key={customer.id}
                          className="group hover:bg-muted/40 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => setViewingCustomer(customer)}
                              className="flex items-center gap-3 text-left w-full hover:opacity-90 transition"
                            >
                              <div
                                className={cn(
                                  "h-10 w-10 rounded-full bg-gradient-to-br text-white grid place-items-center font-black text-xs shadow-sm shrink-0",
                                  avatarGradient(customer.name),
                                )}
                              >
                                {initialsFor(customer.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
                                  <span className="truncate">{customer.name}</span>
                                  {isNew && (
                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-success/10 text-success ring-1 ring-inset ring-success/20">
                                      Novo
                                    </span>
                                  )}
                                  {purchaseStats[customer.id]?.count > 0 && (
                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 tabular-nums">
                                      R$ {purchaseStats[customer.id].total.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} · {purchaseStats[customer.id].count}x
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-foreground/70">
                                    {customerCode(customer)}
                                  </span>
                                  {customer.created_at && (
                                    <>
                                      <span className="opacity-50">·</span>
                                      <span>
                                        Desde{" "}
                                        {new Date(customer.created_at).toLocaleDateString("pt-BR", {
                                          month: "short",
                                          year: "numeric",
                                        })}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-1">
                              {customer.phone && (
                                <div className="flex items-center gap-1.5 text-xs text-foreground/80">
                                  <Phone className="h-3 w-3 text-success" /> {customer.phone}
                                </div>
                              )}
                              {customer.email && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                                  <Mail className="h-3 w-3" /> {customer.email}
                                </div>
                              )}
                              {!customer.phone && !customer.email && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {customer.city ? (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" /> {customer.city}
                                {customer.state ? `/${customer.state}` : ""}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs font-mono text-muted-foreground">
                            {customer.document || "—"}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {customer.phone && (
                                <a
                                  href={`https://wa.me/55${customer.phone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 rounded-lg hover:bg-success/10 text-success transition"
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </a>
                              )}
                              <button
                                onClick={() => handleOpenModal(customer)}
                                className="p-2 rounded-lg hover:bg-warning/10 text-warning transition"
                                title="Editar cadastro"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleViewHistory(customer)}
                                className="p-2 rounded-lg hover:bg-primary/10 text-primary transition"
                                title="Histórico"
                              >
                                <History className="h-4 w-4" />
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition">
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => handleOpenModal(customer)}
                                    className="gap-2"
                                  >
                                    <Edit3 className="h-4 w-4" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleViewHistory(customer)}
                                    className="gap-2"
                                  >
                                    <History className="h-4 w-4" /> Ver Histórico
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(customer.id)}
                                    className="gap-2 text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
