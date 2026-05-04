import { createFileRoute, Link } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Package, Wrench, Plus, Search, Edit3, Trash2, Loader2, Upload,
  Image as ImageIcon, Bot, ArrowLeft, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/crm_/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo — ConectaCRM" },
      { name: "description", content: "Cadastre produtos e serviços para a IA oferecer aos clientes." },
    ],
  }),
  component: CatalogPage,
});

type Tab = "products" | "services";

type Item = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price?: number | null;
  image_url?: string | null;
  is_active?: boolean;
  keywords?: string[] | null;
  // produto
  stock_quantity?: number | null;
  brand?: string | null;
  model?: string | null;
  // serviço
  duration_minutes?: number | null;
};

function CatalogPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("products");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Item | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const table = tab === "products" ? "products" : "services";

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar catálogo.");
    } else {
      setItems((data as Item[]) || []);
    }
    setLoading(false);
  }, [user?.id, table]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este item do catálogo?")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error("Erro ao excluir.");
    else { toast.success("Excluído."); load(); }
  };

  const openNew = () => { setEditing(null); setIsOpen(true); };
  const openEdit = (item: Item) => { setEditing(item); setIsOpen(true); };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Catálogo da IA" subtitle="Produtos e serviços que o bot pode oferecer aos clientes" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Link to="/crm" className="text-xs font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> CRM
            </Link>
          </div>

          {/* Banner IA */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-5 flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-bold font-display">Sua IA usa este catálogo nas respostas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quando um cliente pedir algo (ex: "iPhone"), o bot consulta este catálogo e oferece os itens compatíveis com foto, descrição e preço. Mantenha tudo atualizado.
              </p>
            </div>
            <Link to="/crm/bot" className="text-xs font-bold text-primary hover:underline whitespace-nowrap inline-flex items-center gap-1">
              <Bot className="h-3 w-3" /> Configurar bot
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl w-fit">
            <button
              onClick={() => setTab("products")}
              className={`px-4 h-9 rounded-lg text-sm font-bold transition flex items-center gap-2 ${tab === "products" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Package className="h-4 w-4" /> Produtos
            </button>
            <button
              onClick={() => setTab("services")}
              className={`px-4 h-9 rounded-lg text-sm font-bold transition flex items-center gap-2 ${tab === "services" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Wrench className="h-4 w-4" /> Serviços
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder={`Buscar ${tab === "products" ? "produtos" : "serviços"}...`}
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border outline-none text-sm focus:border-primary/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={openNew}
              className="h-10 px-5 rounded-xl flex items-center gap-2 text-sm font-bold shadow-glow bg-gradient-primary text-white hover:opacity-95"
            >
              <Plus className="h-4 w-4" /> Novo {tab === "products" ? "produto" : "serviço"}
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {loading ? (
              <div className="col-span-full py-20 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full rounded-2xl bg-card border border-dashed border-border p-12 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
                  {tab === "products" ? <Package className="h-6 w-6 text-muted-foreground" /> : <Wrench className="h-6 w-6 text-muted-foreground" />}
                </div>
                <h3 className="text-lg font-bold">Catálogo vazio</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Cadastre seus {tab === "products" ? "produtos" : "serviços"} com fotos, descrição e preço para a IA conseguir oferecer aos clientes automaticamente.
                </p>
                <button onClick={openNew} className="mt-4 h-10 px-5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-95 inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Adicionar primeiro item
                </button>
              </div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="rounded-2xl bg-card border border-border overflow-hidden shadow-card hover:shadow-elegant transition group">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
                    ) : (
                      <div className="w-full h-full grid place-items-center">
                        <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    )}
                    {item.is_active === false && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold uppercase">Inativo</div>
                    )}
                  </div>
                  <div className="p-4">
                    {item.category && <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1 truncate">{item.category}</div>}
                    <h3 className="font-bold text-sm mb-1 line-clamp-1">{item.name}</h3>
                    {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2 min-h-[32px]">{item.description}</p>}
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-base font-bold font-display">
                        {Number(item.price ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                      {tab === "products" && typeof item.stock_quantity === "number" && (
                        <div className="text-[10px] text-muted-foreground">Estoque: <span className="font-bold text-foreground">{item.stock_quantity}</span></div>
                      )}
                      {tab === "services" && item.duration_minutes != null && (
                        <div className="text-[10px] text-muted-foreground">{item.duration_minutes} min</div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                      <button onClick={() => openEdit(item)} className="flex-1 h-8 rounded-lg text-xs font-bold bg-muted hover:bg-muted/70 inline-flex items-center justify-center gap-1">
                        <Edit3 className="h-3 w-3" /> Editar
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 grid place-items-center">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      <CatalogForm
        open={isOpen}
        onOpenChange={setIsOpen}
        kind={tab}
        item={editing}
        userId={user?.id}
        onSaved={() => { setIsOpen(false); setEditing(null); load(); }}
      />
    </div>
  );
}

function CatalogForm({
  open, onOpenChange, kind, item, userId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: Tab;
  item: Item | null;
  userId?: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [duration, setDuration] = useState("");
  const [keywords, setKeywords] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setDescription(item?.description ?? "");
      setCategory(item?.category ?? "");
      setPrice(item?.price != null ? String(item.price) : "");
      setStock(item?.stock_quantity != null ? String(item.stock_quantity) : "");
      setDuration(item?.duration_minutes != null ? String(item.duration_minutes) : "");
      setKeywords((item?.keywords ?? []).join(", "));
      setImageUrl(item?.image_url ?? null);
      setActive(item?.is_active !== false);
    }
  }, [open, item]);

  const handleUpload = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${kind}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("catalog").upload(path, file, {
        upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("catalog").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Imagem enviada!");
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao enviar imagem: " + (e.message ?? ""));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId || !name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const kw = keywords.split(",").map((k) => k.trim()).filter(Boolean);
      const base: any = {
        user_id: userId,
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        price: parseFloat(price) || 0,
        image_url: imageUrl,
      };
      if (kind === "products") {
        base.stock_quantity = parseInt(stock) || 0;
      } else {
        base.duration_minutes = duration ? parseInt(duration) : null;
        base.is_active = active;
        base.keywords = kw;
      }

      const table = kind === "products" ? "products" : "services";
      if (item?.id) {
        const { error } = await supabase.from(table).update(base).eq("id", item.id);
        if (error) throw error;
        toast.success("Atualizado!");
      } else {
        const { error } = await supabase.from(table).insert(base);
        if (error) throw error;
        toast.success("Cadastrado!");
      }
      onSaved();
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar: " + (e.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? "Editar" : "Novo"} {kind === "products" ? "produto" : "serviço"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Imagem */}
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Foto</Label>
            <div className="flex items-center gap-4">
              <div className="h-28 w-28 rounded-xl bg-muted overflow-hidden border border-border grid place-items-center shrink-0">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Upload className="h-3 w-3 mr-2" />}
                  {imageUrl ? "Trocar imagem" : "Enviar imagem"}
                </Button>
                {imageUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(null)}>
                    Remover
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground">JPG, PNG ou WEBP até 5MB</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "products" ? "Ex: iPhone 15 Pro 256GB" : "Ex: Troca de tela iPhone"} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Categoria</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={kind === "products" ? "iPhone, Xiaomi..." : "Reparo, Instalação..."} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Preço (R$)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
            </div>

            {kind === "products" ? (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Estoque</Label>
                <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Duração (min)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="60" />
              </div>
            )}

            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detalhes que ajudam a IA a oferecer corretamente: características, vantagens, condições..." />
            </div>

            {kind === "services" && (
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Palavras-chave (separadas por vírgula)</Label>
                <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="tela quebrada, display, vidro" />
                <p className="text-[10px] text-muted-foreground">Ajudam a IA a identificar quando oferecer este serviço.</p>
              </div>
            )}

            {kind === "services" && (
              <div className="col-span-2 flex items-center justify-between bg-muted/30 rounded-lg p-3">
                <div>
                  <Label className="text-xs font-bold">Serviço ativo</Label>
                  <p className="text-[10px] text-muted-foreground">Quando inativo, a IA não oferece este item.</p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
            {item ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}