import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import {
  ShoppingBag,
  Plus,
  MoreVertical,
  Search,
  Filter,
  Loader2,
  Package,
  Trash2,
  Edit3,
  CheckCircle2,
} from "lucide-react";
import { X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
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

import { ProductForm } from "@/components/estoque/ProductForm";

export const Route = createFileRoute("/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — ConectaCRM" },
      { name: "description", content: "Gerencie seu catálogo de produtos e serviços." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStock, setFilterStock] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock_quantity: "",
    category: "Smartphones",
    description: "",
  });

  const fetchProducts = useCallback(async () => {
    if (!user?.id || !orgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar catálogo.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSave = async (data?: any) => {
    if (!user?.id) return;
    if (!orgId) {
      toast.error("Crie ou selecione uma loja antes de cadastrar produtos.");
      return;
    }
    const isFormEvent =
      data && typeof data === "object" && ("nativeEvent" in data || "currentTarget" in data);
    const dataToSave =
      data && !isFormEvent
        ? data
        : {
            name: formData.name,
            price: parseFloat(formData.price) || 0,
            stock_quantity: parseInt(formData.stock_quantity) || 0,
            category: formData.category,
            description: formData.description,
          };

    if (!dataToSave.name) return;

    setSaving(true);
    try {
      const {
        stock,
        imei,
        imei2,
        color,
        capacity,
        processor,
        ram,
        display,
        margin,
        markup,
        battery_health,
        observations,
        store,
        ...productFields
      } = dataToSave;
      const payload = {
        user_id: user.id,
        organization_id: orgId,
        ...productFields,
        price: parseFloat(dataToSave.price) || 0,
        stock_quantity: parseInt(stock || dataToSave.stock_quantity) || 0,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
        toast.success("Produto atualizado!");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Produto cadastrado!");
      }

      setEditingProduct(null);
      setIsAddOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(
        error?.message ? `Erro ao salvar produto: ${error.message}` : "Erro ao salvar produto.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      toast.success("Produto excluído.");
      fetchProducts();
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  };

  const categoryOptions = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean)),
  ) as string[];

  const filteredProducts = products
    .filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchesTerm =
        !term ||
        p.name?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term);
      const matchesCategory = filterCategory === "all" || p.category === filterCategory;
      const stock = Number(p.stock_quantity ?? 0);
      const matchesStock =
        filterStock === "all" ||
        (filterStock === "in" && stock > 0) ||
        (filterStock === "out" && stock <= 0) ||
        (filterStock === "low" && stock > 0 && stock <= (p.min_stock ?? 3));
      return matchesTerm && matchesCategory && matchesStock;
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") return Number(a.price ?? 0) - Number(b.price ?? 0);
      if (sortBy === "price_desc") return Number(b.price ?? 0) - Number(a.price ?? 0);
      if (sortBy === "name") return (a.name ?? "").localeCompare(b.name ?? "");
      if (sortBy === "stock_desc")
        return Number(b.stock_quantity ?? 0) - Number(a.stock_quantity ?? 0);
      return 0; // recent (already ordered by created_at desc)
    });

  const activeFilters =
    (filterCategory !== "all" ? 1 : 0) +
    (filterStock !== "all" ? 1 : 0) +
    (sortBy !== "recent" ? 1 : 0);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <ProductForm
        open={isAddOpen || !!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingProduct(null);
          }
        }}
        product={editingProduct}
        onSave={handleSave}
      />
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Catálogo de Produtos" subtitle="Gerencie o que você vende" />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Quick Add Section */}
          <div
            className={`mb-6 transition-all duration-300 overflow-hidden ${isQuickAddOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                  <Plus className="h-4 w-4" /> Cadastro Rápido de Produto
                </h3>
                <button
                  onClick={() => setIsQuickAddOpen(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                    Nome do Produto
                  </Label>
                  <Input
                    placeholder="Ex: iPhone 15 Pro"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-card h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                    Preço (R$)
                  </Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="bg-card h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                    Estoque
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="bg-card h-11"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleSave()}
                    disabled={saving}
                    className="flex-1 h-11 font-bold"
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
                    onClick={() => setIsAddOpen(true)}
                    className="h-11 px-4"
                  >
                    Completo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-sm w-full">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Buscar produtos..."
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border outline-none text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="h-10 px-3 rounded-xl bg-card border border-border text-sm font-medium outline-none hover:bg-muted transition cursor-pointer"
                aria-label="Filtrar por categoria"
              >
                <option value="all">Todas categorias</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={filterStock}
                onChange={(e) => setFilterStock(e.target.value)}
                className="h-10 px-3 rounded-xl bg-card border border-border text-sm font-medium outline-none hover:bg-muted transition cursor-pointer"
                aria-label="Filtrar por estoque"
              >
                <option value="all">Todo estoque</option>
                <option value="in">Com estoque</option>
                <option value="low">Estoque baixo</option>
                <option value="out">Sem estoque</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 px-3 rounded-xl bg-card border border-border text-sm font-medium outline-none hover:bg-muted transition cursor-pointer"
                aria-label="Ordenar"
              >
                <option value="recent">Mais recentes</option>
                <option value="name">Nome (A-Z)</option>
                <option value="price_asc">Menor preço</option>
                <option value="price_desc">Maior preço</option>
                <option value="stock_desc">Maior estoque</option>
              </select>
              {activeFilters > 0 && (
                <button
                  onClick={() => {
                    setFilterCategory("all");
                    setFilterStock("all");
                    setSortBy("recent");
                  }}
                  className="h-10 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition flex items-center gap-1.5"
                  title="Limpar filtros"
                >
                  <X className="h-3.5 w-3.5" /> Limpar ({activeFilters})
                </button>
              )}
              <div className="w-px h-6 bg-border mx-1" />
              <button
                onClick={() => setIsAddOpen(true)}
                className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-glow transition bg-gradient-primary text-white hover:opacity-95"
              >
                <Plus className="h-4 w-4" /> Novo Produto
              </button>
              <button
                onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
                className={`h-10 px-4 rounded-xl border border-border text-sm font-medium transition flex items-center gap-2 ${isQuickAddOpen ? "bg-primary/10 text-primary border-primary/20" : "bg-card hover:bg-muted"}`}
              >
                <Plus className="h-4 w-4" /> Cadastro Rápido
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {loading ? (
              <div className="col-span-full py-20 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground mt-2">Carregando catálogo...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full rounded-2xl bg-card border border-border p-12 text-center shadow-card">
                <div className="h-14 w-14 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Nenhum produto encontrado</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Cadastre seus produtos ou serviços para começar a vender pelo CRM.
                </p>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => setEditingProduct(product)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditingProduct(product);
                    }
                  }}
                  className="rounded-2xl bg-card border border-border overflow-hidden shadow-card hover:shadow-elegant transition-all group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="h-40 bg-muted grid place-items-center relative overflow-hidden">
                    {(product.image_url || product.metadata?.image_url) ? (
                      <img
                        src={product.image_url || product.metadata?.image_url}
                        alt={product.name}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <ShoppingBag className="h-12 w-12 text-muted-foreground/30 group-hover:scale-110 transition duration-300" />
                    )}
                    <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm grid place-items-center hover:bg-white text-foreground shadow-sm">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingProduct(product)}
                            className="gap-2"
                          >
                            <Edit3 className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(product.id)}
                            className="gap-2 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
                      {typeof product.category === "string" ? product.category : ""}
                    </div>
                    <h3 className="font-bold text-sm mb-1 truncate">
                      {typeof product.name === "string" ? product.name : "Sem nome"}
                    </h3>
                    <div className="text-lg font-bold font-display text-foreground">
                      {(Number(product.price) || 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">
                        Estoque:{" "}
                        <span
                          className={`font-semibold ${product.stock_quantity <= (product.min_stock || 0) ? "text-destructive" : "text-foreground"}`}
                        >
                          {Number(product.stock_quantity) || 0}
                        </span>
                      </span>
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="text-[11px] font-bold text-primary hover:underline"
                      >
                        Ver detalhes
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
