import { useState, useMemo, useEffect } from "react";
import { 
  Package, Search, Plus, Filter, MoreHorizontal, ArrowUpDown, 
  AlertTriangle, Edit, Trash2, History, Layers, TrendingUp, 
    Clock, FileDown, FileUp, Smartphone, Tablet, Watch, Loader2, X, Tags, BarChart3
} from "lucide-react";
  import { ProductForm } from "./ProductForm";
  import { StockImport } from "./StockImport";
 import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
 
  export function StockList() {
    const { user } = useAuth();
    const [isAddOpen, setIsAddOpen] = useState(false);
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
    const [quickProduct, setQuickProduct] = useState({ name: "", price: "", stock: "", category: "Acessórios", cost_price: "" });

    const fetchProducts = async (pageNum: number, isInitial = false) => {
      if (!user?.id) return;
      if (isInitial) {
        setLoading(true);
        setPage(0);
      }
      
      const { data: profile } = await supabase.from('profiles').select('owner_id').eq('id', user.id).maybeSingle();
      const ownerId = profile?.owner_id || user.id;

      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (error) {
        toast.error("Erro ao carregar produtos: " + error.message);
      } else {
        const rows = (data ?? []).map((p: any) => ({ ...p, stock: p.stock_quantity ?? 0 }));
        if (isInitial) {
          setLocalProducts(rows);
        } else {
          setLocalProducts(prev => [...prev, ...rows]);
        }
        setHasMore(rows.length === PAGE_SIZE);
      }
      
      if (isInitial) setLoading(false);
    };
 
      useEffect(() => {
        if (user?.id) {
          // Executa as duas buscas em paralelo para ganhar tempo
          Promise.all([
            fetchProducts(0, true),
            fetchStats()
          ]);
        }
      }, [user?.id]);
 
     const handleLoadMore = () => {
       const nextPage = page + 1;
       setPage(nextPage);
       fetchProducts(nextPage);
     };

    const [totalStats, setTotalStats] = useState({ totalValue: 0, totalCost: 0, lowStock: 0, outOfStock: 0, totalItems: 0 });

    const fetchStats = async () => {
      if (!user?.id) return;
      const { data: profile } = await supabase.from('profiles').select('owner_id').eq('id', user.id).maybeSingle();
      const ownerId = profile?.owner_id || user.id;

      const { data, error } = await supabase
        .from('products')
        .select('price, cost_price, stock_quantity, min_stock')
        .eq('user_id', ownerId);

      if (error) return;
      
      const stats = data.reduce((acc, p) => {
        const stock = p.stock_quantity || 0;
        const price = p.price || 0;
        const cost = p.cost_price || 0;
        const min = p.min_stock || 3;
        
        acc.totalValue += price * stock;
        acc.totalCost += cost * stock;
        if (stock <= min && stock > 0) acc.lowStock++;
        if (stock === 0) acc.outOfStock++;
        acc.totalItems++;
        return acc;
      }, { totalValue: 0, totalCost: 0, lowStock: 0, outOfStock: 0, totalItems: 0 });

      setTotalStats(stats);
    };

    // Removido useEffect que chamava fetchStats a cada mudança em localProducts.length
    // Agora chamaremos fetchStats manualmente apenas quando necessário ou usaremos atualização local.
 
    const handleExport = () => {
      const headers = ["ID", "Nome", "SKU", "IMEI 1", "IMEI 2", "Categoria", "Marca", "Fornecedor", "Cor", "Capacidade", "Saúde Bateria", "Estoque", "Min Estoque", "Preço Venda", "Preço Custo", "Localização", "Observações"];
      const rows = filteredProducts.map(p => [
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
        p.observations || ""
      ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(cell => `"${cell}"`).join(","))].join("\n");
 
     const encodedUri = encodeURI(csvContent);
     const link = document.createElement("a");
     link.setAttribute("href", encodedUri);
     link.setAttribute("download", `estoque_${new Date().toISOString().split('T')[0]}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     toast.success("Relatório exportado!");
   };
 
  const filteredProducts = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return localProducts.filter(product => {
      const matchesSearch = 
        product.name.toLowerCase().includes(lowerSearch) || 
        (product.sku?.toLowerCase().includes(lowerSearch)) ||
        (product.imei?.toLowerCase().includes(lowerSearch)) ||
        (product.imei2?.toLowerCase().includes(lowerSearch)) ||
        (product.ean?.toLowerCase().includes(lowerSearch)) ||
        (product.reference?.toLowerCase().includes(lowerSearch)) ||
        (product.brand?.toLowerCase().includes(lowerSearch)) ||
        (product.supplier?.toLowerCase().includes(lowerSearch));
      
      const matchesCategory = filterCategory === "all" || product.category === filterCategory;
      
      const isLowStock = (product.stock || 0) <= (product.min_stock || 3) && (product.stock || 0) > 0;
      const isOutOfStock = (product.stock || 0) === 0;

      if (viewTab === "low") return matchesSearch && matchesCategory && isLowStock;
      if (viewTab === "out") return matchesSearch && matchesCategory && isOutOfStock;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, filterCategory, viewTab, localProducts]);

  const handleAddProduct = async (data: any) => {
    if (!user?.id) return;
    const { data: profile } = await supabase.from('profiles').select('owner_id').eq('id', user.id).maybeSingle();
    const ownerId = profile?.owner_id || user.id;

    const payload = {
      user_id: ownerId,
      ...data,
      price: Number(data.price || 0),
      cost_price: Number(data.cost_price || 0),
      stock_quantity: Number(data.stock || 0),
      min_stock: Number(data.min_stock || 0),
      wholesale_price: Number(data.wholesale_price || 0),
      weight: Number(data.weight || 0),
    };
    delete payload.stock; // Remove virtual field

    const { data: row, error } = await supabase.from("products").insert(payload).select().single();
    if (error) return toast.error("Erro ao criar: " + error.message);
    setLocalProducts((prev) => [{ ...row, stock: row.stock_quantity }, ...prev]);
    fetchStats(); // Atualiza estatísticas após inserção
    toast.success("Produto criado!");
  };

  const handleUpdateProduct = async (data: any) => {
    if (!editingProduct) return;
    const payload = {
      ...data,
      price: Number(data.price || 0),
      cost_price: Number(data.cost_price || 0),
      stock_quantity: Number(data.stock || 0),
      min_stock: Number(data.min_stock || 0),
      wholesale_price: Number(data.wholesale_price || 0),
      weight: Number(data.weight || 0),
    };
    delete payload.stock; // Remove virtual field
    delete payload.id;
    delete payload.user_id;
    delete payload.created_at;
    delete payload.updated_at;

    const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    setLocalProducts((prev) => prev.map((p) => p.id === editingProduct.id ? { ...p, ...payload, stock: payload.stock_quantity } : p));
    fetchStats(); // Atualiza estatísticas após atualização
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
      if (!user?.id) return;
      if (!quickProduct.name.trim()) { toast.error("Nome é obrigatório"); return; }
      setLoading(true);
      const { data: profile } = await supabase.from('profiles').select('owner_id').eq('id', user.id).maybeSingle();
      const ownerId = profile?.owner_id || user.id;

      const payload = {
        user_id: ownerId,
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

   return (
     <div className="space-y-6">
        
        {/* Quick Add Section */}
        <div className={`transition-all duration-300 overflow-hidden ${isQuickAddOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm mb-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                <Plus className="h-4 w-4" /> Cadastro Rápido de Produto
              </h3>
              <button onClick={() => setIsQuickAddOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="space-y-1.5 md:col-span-3">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nome do Produto</Label>
                <input 
                  placeholder="Ex: Carregador USB-C" 
                  value={quickProduct.name}
                  onChange={(e) => setQuickProduct({...quickProduct, name: e.target.value})}
                  className="w-full h-11 px-4 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Custo (R$)</Label>
                <input 
                  type="number"
                  placeholder="0,00" 
                  value={quickProduct.cost_price}
                  onChange={(e) => setQuickProduct({...quickProduct, cost_price: e.target.value})}
                  className="w-full h-11 px-4 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Venda (R$)</Label>
                <input 
                  type="number"
                  placeholder="0,00" 
                  value={quickProduct.price}
                  onChange={(e) => setQuickProduct({...quickProduct, price: e.target.value})}
                  className="w-full h-11 px-4 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Estoque</Label>
                <input 
                  type="number"
                  placeholder="0" 
                  value={quickProduct.stock}
                  onChange={(e) => setQuickProduct({...quickProduct, stock: e.target.value})}
                  className="w-full h-11 px-4 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Categoria</Label>
                <Select value={quickProduct.category} onValueChange={(v) => setQuickProduct({...quickProduct, category: v})}>
                  <SelectTrigger className="w-full h-11 rounded-xl bg-card border-border">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Smartphones">Smartphones</SelectItem>
                    <SelectItem value="Tablets">Tablets</SelectItem>
                    <SelectItem value="Acessórios">Acessórios</SelectItem>
                    <SelectItem value="Serviços">Serviços</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 md:col-span-2">
                <button 
                  onClick={handleQuickAdd} 
                  disabled={loading}
                  className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-glow hover:opacity-90 transition disabled:opacity-50"
                >
                  Cadastrar
                </button>
                <button 
                  onClick={() => setIsAddOpen(true)}
                  className="h-11 px-4 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition"
                >
                  Completo
                </button>
              </div>
            </div>
          </div>
        </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
         {[
            { label: "Total de Itens", value: totalStats.totalItems, icon: Layers, color: "indigo" },
            { label: "Venda Estimada", value: totalStats.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: TrendingUp, color: "emerald" },
            { label: "Custo Total", value: totalStats.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: Tags, color: "violet" },
            { label: "Estoque Baixo", value: totalStats.lowStock, icon: Clock, color: "amber" },
            { label: "Esgotados", value: totalStats.outOfStock, icon: AlertTriangle, color: "red" },
         ].map((stat, i) => (
           <Card key={i} className="bg-white border border-slate-100 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden">
             <CardContent className="p-6">
               <div className={`h-12 w-12 rounded-2xl bg-${stat.color}-500 text-white grid place-items-center shadow-lg shadow-${stat.color}-500/20 group-hover:scale-110 transition-transform mb-4`}>
                 <stat.icon className="h-6 w-6" />
               </div>
               <div className="space-y-1">
                 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                 <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{stat.value || 0}</h3>
               </div>
             </CardContent>
           </Card>
         ))}
       </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border">
        <Tabs value={viewTab} onValueChange={setViewTab} className="w-full xl:w-auto">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="low" className="text-orange-500">Estoque Baixo</TabsTrigger>
            <TabsTrigger value="out" className="text-destructive">Esgotados</TabsTrigger>
          </TabsList>
        </Tabs>

         <div className="flex items-center gap-3">
               <div className="relative flex-1 md:w-96">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <input 
               placeholder="Buscar por nome, categoria ou IMEI..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20 transition"
             />
           </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-card border-border">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Categoria" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="Smartphones">Smartphones</SelectItem>
              <SelectItem value="Acessórios">Acessórios</SelectItem>
            </SelectContent>
          </Select>
         </div>

         <div className="flex items-center gap-2 shrink-0">
           <StockImport onImported={(newProducts) => {
             setLocalProducts(prev => [...newProducts.map(p => ({ ...p, stock: p.stock_quantity || 0 })), ...prev]);
           }} />
           <button 
             onClick={handleExport}
             className="h-10 px-4 rounded-xl border border-border bg-card text-sm font-medium hover:bg-muted transition flex items-center gap-2"
           >
             <FileDown className="h-4 w-4" /> Exportar
           </button>
          <button onClick={() => setIsAddOpen(true)} className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-glow transition bg-gradient-primary text-white hover:opacity-95">
            <Plus className="h-4 w-4" /> Novo Produto
          </button>
          <button onClick={() => setIsQuickAddOpen(!isQuickAddOpen)} className={`h-10 px-4 rounded-xl border border-border text-sm font-medium transition flex items-center gap-2 ${isQuickAddOpen ? "bg-primary/10 text-primary border-primary/20" : "bg-card hover:bg-muted"}`}>
            <Plus className="h-4 w-4" /> Cadastro Rápido
          </button>
        </div>
       </div>
 
       <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
         <div className="overflow-x-auto">
           <table className="w-full text-left border-collapse">
             <thead>
                <tr className="border-b border-border bg-muted/30">
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Produto / Marca</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] text-center">Identificação</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Categoria</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] text-center">Estoque</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Preço Venda</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Lucro Est.</th>
                    <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] text-right">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-border">
                 {filteredProducts.map((product) => (
                   <tr 
                     key={product.id} 
                     className="hover:bg-muted/30 transition-colors cursor-pointer group"
                     onClick={() => setEditingProduct(product)}
                   >
                     <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-4">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-xl object-cover shrink-0 border border-border shadow-sm group-hover:scale-110 transition-transform" />
                          ) : (
                            <div className="h-12 w-12 rounded-xl bg-muted grid place-items-center shrink-0 border border-border group-hover:bg-primary/10 transition-colors">
                              <Package className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <div className="font-bold text-sm text-foreground leading-tight group-hover:text-primary transition-colors">{product.name}</div>
                            <div className="flex flex-wrap items-center gap-2">
                              {product.brand && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold border border-blue-100 uppercase tracking-tighter">
                                  {product.brand}
                                </span>
                              )}
                              {product.reference && (
                                <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold border border-amber-100 uppercase tracking-tighter">
                                  {product.reference}
                                </span>
                              )}
                              {product.imei && (
                                <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded">
                                  IMEI: {product.imei}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                     <td className="px-6 py-5">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded leading-none">{product.ncm || '---'}</span>
                        <span className="text-[10px] font-mono text-muted-foreground leading-none">{product.ean || '---'}</span>
                      </div>
                    </td>
                     <td className="px-6 py-5">
                      <span className="text-xs px-2 py-1 rounded bg-muted font-medium">{product.category}</span>
                    </td>
                 <td className="px-6 py-5 text-center">
                  <div className="inline-flex flex-col items-center">
                    <div className="flex items-center gap-2 group">
                       <button 
                         onClick={async (e) => {
                           e.stopPropagation();
                           const newStock = Math.max(0, (product.stock || 0) - 1);
                           const { error } = await supabase.from("products").update({ stock_quantity: newStock }).eq("id", product.id);
                           if (!error) {
                             setLocalProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock, stock_quantity: newStock } : p));
                             fetchStats();
                           }
                         }}
                         className="h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-destructive hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                       >
                         -
                       </button>
                      <span className={`text-sm font-bold ${(product.stock || 0) <= (product.min_stock || 3) ? 'text-destructive' : 'text-foreground'}`}>
                        {product.stock || 0}
                      </span>
                       <button 
                         onClick={async (e) => {
                           e.stopPropagation();
                           const newStock = (product.stock || 0) + 1;
                           const { error } = await supabase.from("products").update({ stock_quantity: newStock }).eq("id", product.id);
                           if (!error) {
                             setLocalProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock, stock_quantity: newStock } : p));
                             fetchStats();
                           }
                         }}
                         className="h-6 w-6 rounded-full bg-muted flex items-center justify-center hover:bg-primary hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                       >
                         +
                       </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">{product.unit || 'un'}</span>
                    <div className="w-16 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${ (product.stock || 0) <= (product.min_stock || 3) ? 'bg-destructive' : 'bg-primary' }`}
                        style={{ width: `${Math.min(((product.stock || 0) / (product.min_stock ? product.min_stock * 3 : 10)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
                     <td className="px-6 py-5">
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-sm font-black text-primary bg-primary/5 px-2 py-1 rounded-lg">
                            {Number(product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          {product.wholesale_price > 0 && (
                            <span className="text-[10px] text-muted-foreground font-bold ml-1 flex items-center gap-1">
                              <Tags className="h-3 w-3" />
                              Atacado: {Number(product.wholesale_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          )}
                        </div>
                    </td>
                     <td className="px-6 py-5">
                        <div className="flex flex-col gap-2 items-start">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${(product.price - (product.cost_price || 0)) > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-destructive/5 text-destructive border border-destructive/10'}`}>
                            <TrendingUp className="h-3 w-3" />
                            {Number(product.price - (product.cost_price || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border tracking-wider shadow-sm ${ (product.stock || 0) > 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-transparent' : 'bg-slate-100 text-slate-500 border-slate-200' }`}>
                            { (product.stock || 0) > 0 ? 'DISPONÍVEL' : 'ESGOTADO' }
                          </span>
                        </div>
                    </td>
                    <td className="px-6 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                       <div className="flex items-center justify-end gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 rounded-lg hover:bg-muted transition">
                              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem className="gap-2">
                              <History className="h-4 w-4" /> Movimentação
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleDeleteProduct(product.id)} className="gap-2 text-destructive focus:text-destructive">
                               <Trash2 className="h-4 w-4" /> Excluir
                             </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
         {loading && (
           <div className="p-12 grid place-items-center">
             <Loader2 className="h-6 w-6 animate-spin text-primary" />
           </div>
         )}
          {!loading && filteredProducts.length === 0 && (
            <div className="p-16 text-center">
              <div className="h-14 w-14 rounded-full bg-muted grid place-items-center mx-auto mb-3">
                <Package className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <h3 className="text-base font-bold">Nenhum produto encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm || filterCategory !== 'all' ? 'Tente ajustar seus filtros.' : 'Clique em "Novo Produto" para começar.'}
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

        <ProductForm open={isAddOpen} onOpenChange={setIsAddOpen} onSave={handleAddProduct} />
        <ProductForm 
          open={!!editingProduct} 
          onOpenChange={(open) => !open && setEditingProduct(null)} 
          product={editingProduct}
          onSave={handleUpdateProduct}
        />
     </div>
   );
 }