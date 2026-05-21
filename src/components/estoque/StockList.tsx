import { useState, useMemo, useEffect } from "react";
import { toProductCode } from "@/lib/product-code";
import {
  Package,
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  ArrowUpDown,
  AlertTriangle,
  Edit,
  Trash2,
  History,
  Layers,
  TrendingUp,
  Clock,
  FileDown,
  Upload,
  Smartphone,
  Tablet,
  Watch,
  Loader2,
  X,
  Tags,
  BarChart3,
  AlertCircle,
  Copy,
  DollarSign,
  Wallet,
  Percent,
  Boxes,
  PackageX,
  PackageMinus,
  SlidersHorizontal,
} from "lucide-react";
import { ProductForm } from "./ProductForm";
import { ImportModal } from "@/components/import/ImportModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { ExportMenu } from "@/components/ui/ExportMenu";

export function StockList() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [localProducts, setLocalProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [viewTab, setViewTab] = useState("all");
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickProduct, setQuickProduct] = useState({
    name: "",
    price: "",
    stock: "",
    category: "Acessórios",
    cost_price: "",
  });

  const fetchProducts = async (pageNum: number, isInitial = false) => {
    if (!user?.id || !orgId) return;
    if (isInitial) {
      setLoading(true);
      setPage(0);
    }

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (error) {
      toast.error("Erro ao carregar produtos: " + error.message);
    } else {
      const rows = (data ?? []).map((p: any) => ({ ...p, stock: p.stock_quantity ?? 0 }));
      if (isInitial) {
        setLocalProducts(rows);
      } else {
        setLocalProducts((prev) => [...prev, ...rows]);
      }
      setHasMore(rows.length === PAGE_SIZE);
    }

    if (isInitial) setLoading(false);
  };

  useEffect(() => {
    if (user?.id && orgId) {
      Promise.all([fetchProducts(0, true), fetchStats()]);
    }
  }, [user?.id, orgId]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchProducts(nextPage);
  };

  const [totalStats, setTotalStats] = useState({
    totalValue: 0,
    totalCost: 0,
    lowStock: 0,
    outOfStock: 0,
    totalItems: 0,
  });

  const fetchStats = async () => {
    if (!user?.id || !orgId) return;
    const { data, error } = await supabase
      .from("products")
      .select("price, cost_price, stock_quantity, min_stock")
      .eq("organization_id", orgId);

    if (error) return;

    const stats = data.reduce(
      (acc, p) => {
        const stock = p.stock_quantity || 0;
        const price = p.price || 0;
        const cost = p.cost_price || 0;
        const min = p.min_stock || 3;

        acc.totalValue += price * stock;
        acc.totalCost += cost * stock;
        if (stock <= min && stock > 0) acc.lowStock++;
        if (stock <= 0) acc.outOfStock++;
        if (stock > 0) acc.totalItems++;
        return acc;
      },
      { totalValue: 0, totalCost: 0, lowStock: 0, outOfStock: 0, totalItems: 0 },
    );

    setTotalStats(stats);
  };

  // Removido useEffect que chamava fetchStats a cada mudança em localProducts.length
  // Agora chamaremos fetchStats manualmente apenas quando necessário ou usaremos atualização local.

  const handleExport = () => {
    const headers = [
      "ID",
      "Nome",
      "SKU",
      "IMEI 1",
      "IMEI 2",
      "Categoria",
      "Marca",
      "Fornecedor",
      "Cor",
      "Capacidade",
      "Saúde Bateria",
      "Estoque",
      "Min Estoque",
      "Preço Venda",
      "Preço Custo",
      "Localização",
      "Observações",
    ];
    const rows = filteredProducts.map((p) => [
      p.id,
      p.name,
      p.sku || "",
      p.imei || "",
      p.imei2 || "",
      p.category || "",
      p.brand || "",
      p.supplier || "",
      p.color || "",
      p.capacity || "",
      p.battery_health || "",
      p.stock || 0,
      p.min_stock || 0,
      p.price,
      p.cost_price || 0,
      p.location || "",
      p.observations || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((cell) => `"${cell}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `estoque_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório exportado!");
  };

  const filteredProducts = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return localProducts.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(lowerSearch) ||
        product.sku?.toLowerCase().includes(lowerSearch) ||
        product.imei?.toLowerCase().includes(lowerSearch) ||
        product.imei2?.toLowerCase().includes(lowerSearch) ||
        product.ean?.toLowerCase().includes(lowerSearch) ||
        product.reference?.toLowerCase().includes(lowerSearch) ||
        product.brand?.toLowerCase().includes(lowerSearch) ||
        product.supplier?.toLowerCase().includes(lowerSearch);

      const matchesCategory = filterCategory === "all" || product.category === filterCategory;

      const isLowStock =
        (product.stock || 0) <= (product.min_stock || 3) && (product.stock || 0) > 0;
      const isOutOfStock = (product.stock || 0) === 0;

      if (viewTab === "low") return matchesSearch && matchesCategory && isLowStock;
      if (viewTab === "out") return matchesSearch && matchesCategory && isOutOfStock;

      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, filterCategory, viewTab, localProducts]);

  const normalizeProductPayload = (data: any) => {
    const md = data.metadata || {};
    const qty = Number(data.stock_quantity ?? data.stock ?? 0);
    const payload: any = {
      name: data.name,
      sku: data.sku || null,
      ean: data.ean || null,
      category: data.category || null,
      brand: data.brand || null,
      supplier: data.supplier || null,
      model: data.model || null,
      description: data.description || null,
      unit: data.unit || "un",
      price: Number(data.price || 0),
      cost_price: Number(data.cost_price || 0),
      wholesale_price: data.wholesale_price ? Number(data.wholesale_price) : null,
      stock_quantity: qty,
      min_stock: Number(data.min_stock || 0),
      weight: md.peso ? Number(md.peso) : null,
      ncm: md.ncm || null,
      image_url: md.image_url || data.image_url || null,
      has_imei: Boolean(md.imei || md.imei2),
      metadata: md,
    };
    return payload;
  };

  const registerImeis = async (productId: string, md: any) => {
    const imeis = [md.imei, md.imei2].filter((x: string) => x && String(x).trim().length > 0);
    if (!imeis.length) return;
    const rows = imeis.map((imei: string) => ({
      organization_id: orgId,
      product_id: productId,
      imei: String(imei).trim(),
      serial: md.serial || null,
      status: "in_stock",
      cost_price: md.valor_custo ? Number(md.valor_custo) : null,
    }));
    await supabase.from("product_imei").upsert(rows, { onConflict: "organization_id,imei" });
  };

  const linkToNota = async (productId: string, productName: string, md: any) => {
    if (!md?.nota_id) return;
    const { data: nota } = await supabase
      .from("finance_transactions")
      .select("products_list")
      .eq("id", md.nota_id)
      .maybeSingle();
    const list = Array.isArray(nota?.products_list) ? nota!.products_list : [];
    list.push({ product_id: productId, name: productName, qty: Number(md.quantidade || 1) });
    await supabase
      .from("finance_transactions")
      .update({ products_list: list })
      .eq("id", md.nota_id);
  };

  const handleAddProduct = async (data: any) => {
    if (!user?.id || !orgId) return toast.error("Organização não encontrada");
    const base = normalizeProductPayload(data);
    const payload = { ...base, user_id: user.id, organization_id: orgId };

    const { data: row, error } = await supabase.from("products").insert(payload).select().single();
    if (error) return toast.error("Erro ao criar: " + error.message);

    // Initial stock movement
    if (payload.stock_quantity > 0) {
      await supabase.from("stock_movements").insert({
        organization_id: orgId,
        user_id: user.id,
        product_id: row.id,
        movement_type: "in",
        quantity: payload.stock_quantity,
        unit_cost: payload.cost_price,
        reason: data.metadata?.mov_motivo || "Cadastro inicial",
        notes: data.metadata?.mov_obs || null,
      });
    }

    await registerImeis(row.id, data.metadata || {});
    await linkToNota(row.id, row.name, data.metadata || {});

    setLocalProducts((prev) => [{ ...row, stock: row.stock_quantity }, ...prev]);
    fetchStats();
    toast.success("Produto criado!");
  };

  const handleUpdateProduct = async (data: any) => {
    if (!editingProduct) return;
    const payload = normalizeProductPayload(data);

    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", editingProduct.id);
    if (error) return toast.error("Erro ao salvar: " + error.message);

    await registerImeis(editingProduct.id, data.metadata || {});

    setLocalProducts((prev) =>
      prev.map((p) =>
        p.id === editingProduct.id ? { ...p, ...payload, stock: payload.stock_quantity } : p,
      ),
    );
    fetchStats();
    toast.success("Produto atualizado!");
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir: " + error.message);
    setLocalProducts((prev) => prev.filter((p) => p.id !== id));
    fetchStats(); // Atualiza estatísticas após exclusão
    toast.success("Produto excluído.");
  };

  const handleQuickAdd = async () => {
    if (!user?.id || !orgId) return toast.error("Organização não encontrada");
    if (!quickProduct.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setLoading(true);

    const payload = {
      user_id: user.id,
      organization_id: orgId,
      name: quickProduct.name.trim(),
      cost_price: Number(quickProduct.cost_price || 0),
      price: Number(quickProduct.price || 0),
      stock_quantity: Number(quickProduct.stock || 0),
      category: quickProduct.category,
    };
    const { data: row, error } = await supabase.from("products").insert(payload).select().single();
    setLoading(false);
    if (error) return toast.error("Erro ao criar: " + error.message);
    setLocalProducts((prev) => [{ ...row, stock: row.stock_quantity }, ...prev]);
    toast.success("Produto cadastrado com sucesso!");
    setQuickProduct({ name: "", price: "", stock: "", category: "Acessórios", cost_price: "" });
    setIsQuickAddOpen(false);
  };

  // -------- Column filters (per-column inputs in header) --------
  const [colFilters, setColFilters] = useState({
    cod: "",
    desc: "",
    imei: "",
    dateFrom: "",
    dateTo: "",
    daysMax: "",
    availability: "all", // all | available | out
  });
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [onlyCurrent, setOnlyCurrent] = useState(true);
  const [onlyNfe, setOnlyNfe] = useState(false);
  const [advType, setAdvType] = useState("");
  const [imeiFilter, setImeiFilter] = useState<"all" | "missing" | "duplicate">("all");

  // Categorias que exigem IMEI
  const isPhoneCategory = (cat?: string | null) => {
    const c = String(cat || "").toLowerCase();
    return /(smart|celular|iphone|aparelho|tablet|smartwatch|watch)/.test(c);
  };

  // Helper: pega o IMEI principal de várias fontes possíveis (coluna, metadata, has_imei flag)
  const getPrimaryImei = (p: any): string => {
    const md = (p && typeof p.metadata === "object" && p.metadata) || {};
    const candidate =
      p?.imei ||
      md.imei ||
      md.IMEI ||
      md.imei1 ||
      md.imei_1 ||
      "";
    return String(candidate || "").trim();
  };

  // Mapa de IMEIs duplicados (apenas IMEI principal — IMEI 2 é informação adicional)
  const duplicateImeis = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of localProducts) {
      const k = getPrimaryImei(p);
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const dups = new Set<string>();
    counts.forEach((n, k) => n > 1 && dups.add(k));
    return dups;
  }, [localProducts]);

  const productImeiIssue = (p: any): "missing" | "duplicate" | null => {
    const primary = getPrimaryImei(p);
    if (primary && duplicateImeis.has(primary)) return "duplicate";
    if (isPhoneCategory(p.category) && !primary) return "missing";
    return null;
  };


  const daysInStock = (created: string | null) => {
    if (!created) return 0;
    const diff = Date.now() - new Date(created).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const daysBadge = (days: number) => {
    if (days >= 90)
      return "bg-destructive text-destructive-foreground";
    if (days >= 30) return "bg-orange-500 text-white";
    return "bg-emerald-500 text-white";
  };

  const finalProducts = useMemo(() => {
    return filteredProducts.filter((p) => {
      if (onlyCurrent && (p.stock || 0) <= 0) return false;
      if (onlyNfe && !p.metadata?.nota_id) return false;
      if (advType && !(p.category || "").toLowerCase().includes(advType.toLowerCase()))
        return false;

      if (colFilters.cod && !String(p.sku || p.id).toLowerCase().includes(colFilters.cod.toLowerCase()))
        return false;
      if (colFilters.desc && !String(p.name || "").toLowerCase().includes(colFilters.desc.toLowerCase()))
        return false;
      if (
        colFilters.imei &&
        !`${p.imei || ""} ${p.imei2 || ""}`.toLowerCase().includes(colFilters.imei.toLowerCase())
      )
        return false;

      const d = daysInStock(p.created_at);
      if (colFilters.daysMax && d > Number(colFilters.daysMax)) return false;

      if (colFilters.dateFrom) {
        if (!p.created_at || new Date(p.created_at) < new Date(colFilters.dateFrom)) return false;
      }
      if (colFilters.dateTo) {
        if (!p.created_at || new Date(p.created_at) > new Date(colFilters.dateTo)) return false;
      }
      const available = (p.stock || 0) > 0;
      if (colFilters.availability === "available" && !available) return false;
      if (colFilters.availability === "out" && available) return false;
      if (imeiFilter !== "all") {
        const issue = productImeiIssue(p);
        if (imeiFilter === "missing" && issue !== "missing") return false;
        if (imeiFilter === "duplicate" && issue !== "duplicate") return false;
      }
      return true;
    });
  }, [filteredProducts, colFilters, onlyCurrent, onlyNfe, advType, imeiFilter, duplicateImeis]);

  const clearFilters = () => {
    setSearchTerm("");
    setFilterCategory("all");
    setViewTab("all");
    setColFilters({
      cod: "",
      desc: "",
      imei: "",
      dateFrom: "",
      dateTo: "",
      daysMax: "",
      availability: "all",
    });
    setOnlyCurrent(true);
    setOnlyNfe(false);
    setAdvType("");
    setImeiFilter("all");
  };

  const fmtBRL = (v: number) =>
    Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const ToggleYesNo = ({
    value,
    onChange,
  }: {
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
      <button
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 transition ${
          !value ? "bg-muted text-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"
        }`}
      >
        Não
      </button>
      <button
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 transition ${
          value ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"
        }`}
      >
        Sim
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Package className="h-3.5 w-3.5" />
        <span>Compras</span>
        <span>/</span>
        <span>Estoque</span>
        <span>/</span>
        <span className="text-foreground font-semibold">Listagem</span>
      </div>

      {/* Header card */}
      <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
        <h1 className="text-base font-bold text-foreground tracking-tight">
          Listagem de estoque
        </h1>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* === ACTIONS GROUP === */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-muted hover:bg-muted/70 text-sm font-semibold border border-border transition">
                <Layers className="h-4 w-4 text-primary" />
                {viewTab === "low" ? "Estoque baixo" : viewTab === "out" ? "Esgotados" : "Estoque geral"}
                <ArrowUpDown className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setViewTab("all")}>Todos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewTab("low")}>Estoque baixo</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewTab("out")}>Esgotados</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition shadow-sm">
                <Plus className="h-4 w-4" /> Cadastrar
                <ArrowUpDown className="h-3 w-3 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setIsAddOpen(true)}>
                <Smartphone className="h-4 w-4" /> Produto completo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsQuickAddOpen(true)}>
                <Plus className="h-4 w-4" /> Cadastro rápido
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition shadow-sm"
          >
            <Upload className="h-4 w-4" /> Importar
          </button>

          <ExportMenu
            filename="estoque-atual"
            rows={filteredProducts.filter((p: any) => (p.stock ?? p.stock_quantity ?? 0) > 0)}
            cols={[
              { key: "name", label: "Nome" },
              { key: "sku", label: "SKU" },
              { key: "imei", label: "IMEI" },
              { key: "imei2", label: "IMEI 2" },
              { key: "category", label: "Categoria" },
              { key: "brand", label: "Marca" },
              { key: "supplier", label: "Fornecedor" },
              { key: "color", label: "Cor" },
              { key: "capacity", label: "Capacidade" },
              { key: "battery_health", label: "Saúde Bateria" },
              { key: "stock", label: "Estoque" },
              { key: "min_stock", label: "Min Estoque" },
              { key: "price", label: "Preço Venda" },
              { key: "cost_price", label: "Preço Custo" },
              { key: "location", label: "Localização" },
              { key: "observations", label: "Observações" },
            ]}
          />

          {/* Visual divider */}
          <div className="h-6 w-px bg-border mx-1 hidden md:block" />

          {/* === FILTERS GROUP === */}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-9 w-[170px] rounded-lg bg-muted border-border text-sm font-semibold">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <SelectValue placeholder="Modelo de lista" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              <SelectItem value="Smartphones">Smartphones</SelectItem>
              <SelectItem value="Tablets">Tablets</SelectItem>
              <SelectItem value="Acessórios">Acessórios</SelectItem>
              <SelectItem value="Serviços">Serviços</SelectItem>
            </SelectContent>
          </Select>

          <Select value={imeiFilter} onValueChange={(v) => setImeiFilter(v as any)}>
            <SelectTrigger className="h-9 w-[170px] rounded-lg bg-muted border-border text-sm font-semibold">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <SelectValue placeholder="IMEI" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">IMEI: todos</SelectItem>
              <SelectItem value="missing">Sem IMEI (aparelhos)</SelectItem>
              <SelectItem value="duplicate">IMEI duplicado</SelectItem>
            </SelectContent>
          </Select>

          {(() => {
            const activeCount =
              (filterCategory !== "all" ? 1 : 0) +
              (imeiFilter !== "all" ? 1 : 0) +
              (viewTab !== "all" ? 1 : 0) +
              (onlyCurrent ? 1 : 0) +
              (onlyNfe ? 1 : 0) +
              (advType ? 1 : 0) +
              (searchTerm ? 1 : 0);
            if (activeCount === 0) return null;
            return (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-sm font-semibold transition"
              >
                <X className="h-4 w-4" /> Limpar filtros
                <span className="ml-1 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black">
                  {activeCount}
                </span>
              </button>
            );
          })()}

          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className={`ml-auto inline-flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-semibold transition ${
              advancedOpen
                ? "bg-primary/10 border-primary/40 text-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {advancedOpen ? "Ocultar" : "Mostrar"} filtros avançados
          </button>
        </div>

        {/* Advanced filters */}
        {advancedOpen && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <Label className="text-xs text-muted-foreground font-semibold">
                Apenas estoque atual?
              </Label>
              <div className="mt-1.5">
                <ToggleYesNo value={onlyCurrent} onChange={setOnlyCurrent} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-semibold">
                Apenas estoque com NFe de entrada?
              </Label>
              <div className="mt-1.5">
                <ToggleYesNo value={onlyNfe} onChange={setOnlyNfe} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground font-semibold">
                Aparelho/Acessório/Peça/Bike
              </Label>
              <input
                value={advType}
                onChange={(e) => setAdvType(e.target.value)}
                placeholder="Filtrar por tipo..."
                className="mt-1.5 w-full h-9 px-3 rounded-lg bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="md:col-span-3">
              <button
                onClick={() => fetchProducts(0, true)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition shadow-sm"
              >
                <Search className="h-4 w-4" /> Buscar
              </button>
            </div>
          </div>
        )}
      </div>


      {/* KPIs (compact, clicáveis) */}
      {(() => {
        const margin =
          totalStats.totalValue > 0
            ? ((totalStats.totalValue - totalStats.totalCost) / totalStats.totalValue) * 100
            : 0;
        const fmtBRL = (n: number) =>
          n >= 1000
            ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
            : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const tiles = [
          {
            key: "all",
            label: "Itens",
            value: totalStats.totalItems,
            full: `${totalStats.totalItems} itens`,
            icon: Boxes,
            color: "text-primary",
            bg: "bg-primary/10",
            ring: "ring-primary/30",
            border: "border-primary/60",
            apply: () => {
              setViewTab("all");
              setColFilters((f) => ({ ...f, availability: "all" }));
              setOnlyCurrent(false);
              setOnlyNfe(false);
            },
          },
          {
            key: "value",
            label: "Venda estimada",
            value: fmtBRL(totalStats.totalValue),
            full: totalStats.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            icon: DollarSign,
            color: "text-emerald-600",
            bg: "bg-emerald-500/10",
            ring: "ring-emerald-500/30",
            border: "border-emerald-500/60",
            apply: () => {
              setViewTab("all");
              setColFilters((f) => ({ ...f, availability: "available" }));
              setOnlyCurrent(true);
            },
          },
          {
            key: "cost",
            label: "Custo total",
            value: fmtBRL(totalStats.totalCost),
            full: totalStats.totalCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            icon: Wallet,
            color: "text-info",
            bg: "bg-info/10",
            ring: "ring-info/30",
            border: "border-info/60",
            apply: () => {
              setViewTab("all");
              setColFilters((f) => ({ ...f, availability: "available" }));
              setOnlyCurrent(true);
            },
          },
          {
            key: "margin",
            label: "Margem",
            value: `${margin.toFixed(1)}%`,
            full: `Lucro potencial: ${fmtBRL(totalStats.totalValue - totalStats.totalCost)}`,
            icon: Percent,
            color: "text-violet-600",
            bg: "bg-violet-500/10",
            ring: "ring-violet-500/30",
            border: "border-violet-500/60",
            apply: () => {},
          },
          {
            key: "low",
            label: "Estoque baixo",
            value: totalStats.lowStock,
            full: `${totalStats.lowStock} produtos abaixo do mínimo`,
            icon: PackageMinus,
            color: "text-amber-600",
            bg: "bg-amber-500/10",
            ring: "ring-amber-500/30",
            border: "border-amber-500/60",
            apply: () => {
              setViewTab("low");
              setColFilters((f) => ({ ...f, availability: "available" }));
              setOnlyCurrent(true);
            },
          },
          {
            key: "out",
            label: "Esgotados",
            value: totalStats.outOfStock,
            full: `${totalStats.outOfStock} produtos sem estoque`,
            icon: PackageX,
            color: "text-destructive",
            bg: "bg-destructive/10",
            ring: "ring-destructive/30",
            border: "border-destructive/60",
            apply: () => {
              setViewTab("out");
              setOnlyCurrent(false);
              setOnlyNfe(false);
              setColFilters((f) => ({ ...f, availability: "out" }));
            },
          },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {tiles.map((k) => {
              const active =
                (k.key === "out" && (viewTab === "out" || colFilters.availability === "out")) ||
                (k.key === "low" && viewTab === "low") ||
                (k.key === "all" &&
                  viewTab === "all" &&
                  colFilters.availability === "all" &&
                  !onlyCurrent);
              const Icon = k.icon;
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={k.apply}
                  title={k.full}
                  aria-pressed={active}
                  className={`group relative text-left rounded-2xl ${k.bg} border px-4 py-3.5 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    active ? `${k.border} ring-2 ${k.ring} shadow-md` : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground leading-tight">
                      {k.label}
                    </div>
                    <div className={`h-7 w-7 rounded-lg ${k.bg} ${k.color} flex items-center justify-center ring-1 ring-inset ring-current/10 shrink-0`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div className={`text-xl sm:text-2xl font-black mt-1.5 ${k.color} truncate tracking-tight`}>
                    {k.value || 0}
                  </div>
                  {/* subtle hover sheen */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>
        );
      })()}


      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                {[
                  "Cód.",
                  "Descrição completa",
                  "IMEI",
                  "Valor venda",
                  "Valor custo",
                  "Quantidade",
                  "Data Entrada",
                  "Dias em Estoque",
                  "Disponibilidade",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center"
                  >
                    {h}
                  </th>
                ))}
              </tr>
              {/* Per-column filter row */}
              <tr className="bg-muted/20 border-b border-border">
                <th className="px-3 py-2">
                  <input
                    value={colFilters.cod}
                    onChange={(e) => setColFilters({ ...colFilters, cod: e.target.value })}
                    className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </th>
                <th className="px-3 py-2">
                  <input
                    value={colFilters.desc}
                    onChange={(e) => setColFilters({ ...colFilters, desc: e.target.value })}
                    placeholder="Selecionar"
                    className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </th>
                <th className="px-3 py-2">
                  <input
                    value={colFilters.imei}
                    onChange={(e) => setColFilters({ ...colFilters, imei: e.target.value })}
                    className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </th>
                <th />
                <th />
                <th />
                <th className="px-3 py-2">
                  <div className="space-y-1">
                    <input
                      type="date"
                      value={colFilters.dateFrom}
                      onChange={(e) => setColFilters({ ...colFilters, dateFrom: e.target.value })}
                      className="w-full h-7 px-2 rounded-md bg-background border border-border text-[11px] outline-none"
                    />
                    <input
                      type="date"
                      value={colFilters.dateTo}
                      onChange={(e) => setColFilters({ ...colFilters, dateTo: e.target.value })}
                      className="w-full h-7 px-2 rounded-md bg-background border border-border text-[11px] outline-none"
                    />
                  </div>
                </th>
                <th className="px-3 py-2">
                  <input
                    type="number"
                    value={colFilters.daysMax}
                    placeholder="máx"
                    onChange={(e) => setColFilters({ ...colFilters, daysMax: e.target.value })}
                    className="w-full h-8 px-2 rounded-md bg-background border border-border text-xs outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </th>
                <th className="px-3 py-2">
                  <Select
                    value={colFilters.availability}
                    onValueChange={(v) => setColFilters({ ...colFilters, availability: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="available">Disponível</SelectItem>
                      <SelectItem value="out">Esgotado</SelectItem>
                    </SelectContent>
                  </Select>
                </th>
              </tr>
            </thead>
            <tbody>
              {finalProducts.map((product) => {
                const days = daysInStock(product.created_at);
                const available = (product.stock || 0) > 0;
                const cod = toProductCode({ id: product.id, sku: product.sku });
                const descricao = [
                  product.category || "Produto",
                  product.name,
                  product.imei ? `IMEI: ${product.imei}` : null,
                  product.condition || (product.metadata?.condicao ? product.metadata.condicao : null),
                  product.capacity ? `${product.capacity}` : null,
                  product.color ? product.color.toUpperCase() : null,
                  product.id ? `Id: ${cod}` : null,
                  product.battery_health ? `Saúde bateria: ${product.battery_health}` : null,
                  product.brand ? product.brand.toUpperCase() : null,
                ]
                  .filter(Boolean)
                  .join(" - ");

                return (
                  <tr
                    key={product.id}
                    onClick={() => setEditingProduct(product)}
                    className={`border-b border-border/60 transition-colors cursor-pointer ${
                      available
                        ? "bg-emerald-50/60 hover:bg-emerald-100/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30"
                        : "bg-card hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 w-7 rounded-md border border-border bg-card hover:bg-muted grid place-items-center"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProduct(product);
                              }}
                              className="gap-2"
                            >
                              <Edit className="h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <History className="h-4 w-4" /> Movimentação
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProduct(product.id);
                              }}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <span className="text-xs font-semibold text-foreground">{cod}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="text-xs text-foreground leading-relaxed line-clamp-2">
                        {descricao}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-foreground/80 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <span>{getPrimaryImei(product) || "—"}</span>
                        {(() => {
                          const issue = productImeiIssue(product);
                          if (issue === "duplicate")
                            return (
                              <span
                                title="IMEI duplicado em outro produto"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/30"
                              >
                                <Copy className="h-2.5 w-2.5" /> duplicado
                              </span>
                            );
                          if (issue === "missing")
                            return (
                              <span
                                title="Aparelho sem IMEI cadastrado — clique no produto para preencher"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30"
                              >
                                <AlertCircle className="h-2.5 w-2.5" /> sem IMEI
                              </span>
                            );
                          return null;
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                      {fmtBRL(product.price)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-foreground/80 tabular-nums whitespace-nowrap">
                      {fmtBRL(product.cost_price)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-foreground">
                      {product.stock || 0}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-foreground/80 whitespace-nowrap">
                      {product.created_at
                        ? new Date(product.created_at).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-md text-[11px] font-bold ${daysBadge(
                          days,
                        )}`}
                      >
                        {days}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const dispo = product.metadata?.disponibilidade as string | undefined;
                        const label = dispo || (available ? "Disponível para venda" : "Esgotado");
                        const cls =
                          label === "Disponível para venda"
                            ? "bg-emerald-500 hover:bg-emerald-600"
                            : label === "Reservado"
                              ? "bg-sky-500 hover:bg-sky-600"
                              : label === "Em conserto"
                                ? "bg-amber-500 hover:bg-amber-600"
                                : label === "Indisponível"
                                  ? "bg-slate-500 hover:bg-slate-600"
                                  : "bg-rose-500 hover:bg-rose-600";
                        return (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-white transition shadow-sm ${cls}`}
                              >
                                {label}
                                <ArrowUpDown className="h-3 w-3 opacity-80" />
                              </button>
                            </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation();
                              const newStock = (product.stock || 0) + 1;
                              await supabase
                                .from("products")
                                .update({ stock_quantity: newStock })
                                .eq("id", product.id);
                              setLocalProducts((prev) =>
                                prev.map((p) =>
                                  p.id === product.id
                                    ? { ...p, stock: newStock, stock_quantity: newStock }
                                    : p,
                                ),
                              );
                              fetchStats();
                            }}
                          >
                            + Adicionar 1 ao estoque
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation();
                              const newStock = Math.max(0, (product.stock || 0) - 1);
                              await supabase
                                .from("products")
                                .update({ stock_quantity: newStock })
                                .eq("id", product.id);
                              setLocalProducts((prev) =>
                                prev.map((p) =>
                                  p.id === product.id
                                    ? { ...p, stock: newStock, stock_quantity: newStock }
                                    : p,
                                ),
                              );
                              fetchStats();
                            }}
                          >
                            − Remover 1 do estoque
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="p-10 grid place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {!loading && finalProducts.length === 0 && (
          <div className="p-14 text-center">
            <div className="h-14 w-14 rounded-full bg-muted grid place-items-center mx-auto mb-3">
              <Package className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-bold">Nenhum produto encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Ajuste os filtros ou cadastre um novo produto.
            </p>
          </div>
        )}
        {hasMore && !loading && (
          <div className="p-4 border-t border-border bg-muted/10 flex justify-center">
            <button
              onClick={handleLoadMore}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              Ver mais produtos <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Add modal-style panel */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setIsQuickAddOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold flex items-center gap-2 text-primary">
                <Plus className="h-4 w-4" /> Cadastro rápido
              </h3>
              <button onClick={() => setIsQuickAddOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                placeholder="Nome do produto"
                value={quickProduct.name}
                onChange={(e) => setQuickProduct({ ...quickProduct, name: e.target.value })}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm md:col-span-2"
              />
              <input
                type="number"
                placeholder="Custo"
                value={quickProduct.cost_price}
                onChange={(e) => setQuickProduct({ ...quickProduct, cost_price: e.target.value })}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
              <input
                type="number"
                placeholder="Venda"
                value={quickProduct.price}
                onChange={(e) => setQuickProduct({ ...quickProduct, price: e.target.value })}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
              <input
                type="number"
                placeholder="Estoque"
                value={quickProduct.stock}
                onChange={(e) => setQuickProduct({ ...quickProduct, stock: e.target.value })}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
              <Select value={quickProduct.category} onValueChange={(v) => setQuickProduct({ ...quickProduct, category: v })}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Smartphones">Smartphones</SelectItem>
                  <SelectItem value="Tablets">Tablets</SelectItem>
                  <SelectItem value="Acessórios">Acessórios</SelectItem>
                  <SelectItem value="Serviços">Serviços</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsQuickAddOpen(false)}
                className="h-10 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleQuickAdd}
                disabled={loading}
                className="h-10 px-5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-sm disabled:opacity-50"
              >
                Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}

      <ProductForm open={isAddOpen} onOpenChange={setIsAddOpen} onSave={handleAddProduct} />
      <ProductForm
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        product={editingProduct}
        onSave={handleUpdateProduct}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={() => fetchProducts(0, true)}
        initialKind="estoque"
      />
    </div>
  );
}
