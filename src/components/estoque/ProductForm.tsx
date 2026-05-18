import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus,
  Loader2,
  Smartphone,
  Barcode,
  DollarSign,
  FileText,
  Wallet,
  CreditCard,
  Coins,
  Paperclip,
  ArrowLeftRight,
  ClipboardCheck,
  Info,
  Trash2,
  Upload,
  Calendar as CalendarIcon,
} from "lucide-react";

type ProductType = "Aparelho" | "Acessório" | "Peça";

const IPHONE_MODELS = [
  "iPhone 8 Plus",
  "iPhone X", "iPhone XR", "iPhone XS", "iPhone XS Max",
  "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
  "iPhone 12 mini", "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
  "iPhone 13 mini", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max",
  "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
  "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
  "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max",
  "iPhone 17", "iPhone 17 Plus", "iPhone 17 Pro", "iPhone 17 Pro Max",
];

const IPHONE_CORES = [
  "Preto", "Branco", "Cinza Espacial", "Prateado", "Dourado", "Rose Gold",
  "Vermelho (PRODUCT)RED", "Coral", "Amarelo", "Azul", "Verde", "Verde-meia-noite",
  "Roxo", "Roxo Profundo", "Lilás", "Rosa", "Estelar", "Meia-noite",
  "Azul Sierra", "Azul Pacífico", "Grafite", "Azul Alpino", "Verde Alpino",
  "Titânio Natural", "Titânio Azul", "Titânio Branco", "Titânio Preto",
  "Titânio Deserto", "Titânio Areia", "Ultramarino", "Verde-azulado",
  "Laranja Cósmico", "Azul Profundo",
];

function FieldRow({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-[160px_1fr] items-center gap-3 ${className}`}>
      <Label className="text-xs font-semibold text-muted-foreground text-right">
        {required && <span className="text-destructive mr-1">*</span>}
        {label}:
      </Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface ProductFormData {
  // Core (mapped to columns)
  name: string;
  sku?: string;
  ean?: string;
  category?: string;
  brand?: string;
  supplier?: string;
  model?: string;
  price: number;
  cost_price?: number;
  wholesale_price?: number;
  stock_quantity: number;
  min_stock?: number;
  unit?: string;
  description?: string;
  // Extras → metadata
  metadata?: Record<string, any>;
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  onSave?: (data: ProductFormData) => void;
}

type ExtraRow = { id: string; description: string; amount: string; dueDate?: string };

function generateProductCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRD-${ts}-${rnd}`;
}

function buildInitialForm(product: any) {
  const md = product?.metadata || {};
  return {
    codigo: product?.reference || (product ? product?.id?.slice(0, 8) : generateProductCode()),
    tipo: md.tipo || "Aparelho",
    imei: md.imei || "",
    imei2: md.imei2 || "",
    sku: product?.sku || "",
    ean: product?.ean || "",
    disponibilidade: md.disponibilidade || "Disponível para venda",
    modelo: product?.model || "",
    gb: md.gb || "",
    serial: md.serial || "",
    ram: md.ram || "",
    cor: md.cor || "",
    marca: product?.brand || "",
    categoria: product?.category || "Smartphones",
    subcategoria: md.subcategoria || "",
    saude_bateria: md.saude_bateria || "",
    ciclo_bateria: md.ciclo_bateria || "",
    estado: md.estado || "",
    quantidade: String(product?.stock_quantity ?? 1),
    quantidade_minima: String(product?.min_stock ?? ""),
    valor_custo: String(product?.cost_price ?? ""),
    valor_venda: String(product?.price ?? ""),
    margem: md.margem || "",
    markup: md.markup || "",
    data_entrada: md.data_entrada || new Date().toISOString().slice(0, 10),
    dias_garantia: md.dias_garantia || "90",
    valor_venda_2: md.valor_venda_2 || "",
    valor_venda_3: md.valor_venda_3 || "",
    observacao: product?.description || "",
    tags: (md.tags || []).join(", "),
    // fornecedor
    tipo_fornecedor: md.tipo_fornecedor || "Fornecedor",
    fornecedor: product?.supplier || "",
    // outras informações
    ncm: md.ncm || product?.ncm || "",
    cest: md.cest || "",
    origem: md.origem || "0",
    peso: md.peso || product?.weight || "",
    // forma de pagamento
    forma_pagamento: md.forma_pagamento || "À vista",
    parcelas: md.parcelas || "1",
    // movimentação inicial
    mov_tipo: md.mov_tipo || "entrada",
    mov_motivo: md.mov_motivo || "Compra",
    mov_obs: md.mov_obs || "",
    nota_id: md.nota_id || "",
  };
}

export function ProductForm({ open, onOpenChange, product, onSave }: ProductFormProps) {
  const [activeTab, setActiveTab] = useState("geral");
  const [isSaving, setIsSaving] = useState(false);
  const md = product?.metadata || {};
  const [productType, setProductType] = useState<ProductType>(
    (product?.metadata?.tipo as ProductType) || "Aparelho",
  );

  const [form, setForm] = useState(() => buildInitialForm(product));

  const { orgId } = useOrg();
  const [openNotas, setOpenNotas] = useState<Array<{ id: string; label: string }>>([]);
  const [customTipos, setCustomTipos] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("product_custom_tipos") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem("product_custom_tipos", JSON.stringify(customTipos));
  }, [customTipos]);

  const [customModelos, setCustomModelos] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("product_custom_modelos") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem("product_custom_modelos", JSON.stringify(customModelos));
  }, [customModelos]);

  const [customCores, setCustomCores] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("product_custom_cores") || "[]");
    } catch {
      return [];
    }
  });
  useEffect(() => {
    localStorage.setItem("product_custom_cores", JSON.stringify(customCores));
  }, [customCores]);

  useEffect(() => {
    if (!open || !orgId) return;
    supabase
      .from("finance_transactions")
      .select("id, invoice_number, supplier_name, amount, due_date")
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("due_date", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        setOpenNotas(
          (data ?? []).map((n: any) => ({
            id: n.id,
            label: `${n.invoice_number || n.id.slice(0, 8)} · ${n.supplier_name || "—"} · R$ ${Number(n.amount || 0).toFixed(2)}`,
          })),
        );
      });
  }, [open, orgId]);

  const [contasPagar, setContasPagar] = useState<ExtraRow[]>(md.contas_pagar || []);
  const [custosExtras, setCustosExtras] = useState<ExtraRow[]>(md.custos_extras || []);
  const [anexos, setAnexos] = useState<{ name: string; url?: string }[]>(md.anexos || []);
  const [imageUrlInput, setImageUrlInput] = useState<string>(md.image_url || "");
  const [checklist, setChecklist] = useState<{ id: string; item: string; ok: boolean }[]>(
    md.checklist || [
      { id: "1", item: "Tela sem riscos", ok: false },
      { id: "2", item: "Carregador incluso", ok: false },
      { id: "3", item: "Caixa original", ok: false },
    ],
  );

  // Reset all state when opening with a different product (or new)
  useEffect(() => {
    if (!open) return;
    setActiveTab("geral");
    const fresh = buildInitialForm(product);
    setForm(fresh);
    setProductType((product?.metadata?.tipo as ProductType) || "Aparelho");
    const m = product?.metadata || {};
    setContasPagar(m.contas_pagar || []);
    setCustosExtras(m.custos_extras || []);
    setAnexos(m.anexos || []);
    setImageUrlInput(m.image_url || "");
    setChecklist(
      m.checklist || [
        { id: "1", item: "Tela sem riscos", ok: false },
        { id: "2", item: "Carregador incluso", ok: false },
        { id: "3", item: "Caixa original", ok: false },
      ],
    );
    setPendingFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  // Auto calc lucro / margem / markup
  const lucro = useMemo(() => {
    const v = parseFloat(form.valor_venda) || 0;
    const c = parseFloat(form.valor_custo) || 0;
    return v - c;
  }, [form.valor_venda, form.valor_custo]);

  const margemCalc = useMemo(() => {
    const v = parseFloat(form.valor_venda) || 0;
    if (!v) return 0;
    return (lucro / v) * 100;
  }, [lucro, form.valor_venda]);

  const markupCalc = useMemo(() => {
    const c = parseFloat(form.valor_custo) || 0;
    if (!c) return 0;
    return (lucro / c) * 100;
  }, [lucro, form.valor_custo]);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const uploadPendingFiles = async (): Promise<{ name: string; url: string }[]> => {
    if (!pendingFiles.length || !orgId) return [];
    const uploaded: { name: string; url: string }[] = [];
    for (const file of pendingFiles) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `products/${orgId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("catalog")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) {
        console.error("upload", error);
        continue;
      }
      const { data } = supabase.storage.from("catalog").getPublicUrl(path);
      uploaded.push({ name: file.name, url: data.publicUrl });
    }
    return uploaded;
  };

  const handleSave = async () => {
    if (!form.modelo && !form.sku && !form.marca) {
      alert("Informe ao menos modelo, SKU ou marca.");
      return;
    }
    if (!form.valor_venda || Number(form.valor_venda) <= 0) {
      alert("Informe o valor de venda.");
      return;
    }

    setIsSaving(true);
    try {
      const uploaded = await uploadPendingFiles();
      const allAnexos = [...anexos, ...uploaded];
      const firstImage = uploaded.find((u) => /\.(png|jpe?g|webp|gif|avif)$/i.test(u.name))?.url;

      const name =
        [form.marca, form.modelo, form.gb && `${form.gb}GB`, form.cor]
          .filter(Boolean)
          .join(" ") ||
        form.modelo ||
        form.sku ||
        "Produto sem nome";

      const payload: ProductFormData = {
        name,
        sku: form.sku || undefined,
        ean: form.ean || undefined,
        category: form.categoria || form.tipo,
        brand: form.marca || undefined,
        supplier: form.fornecedor || undefined,
        model: form.modelo || undefined,
        price: parseFloat(form.valor_venda) || 0,
        cost_price: parseFloat(form.valor_custo) || 0,
        wholesale_price: form.valor_venda_2 ? parseFloat(form.valor_venda_2) : undefined,
        stock_quantity: parseInt(form.quantidade) || 0,
        min_stock: form.quantidade_minima ? parseInt(form.quantidade_minima) : undefined,
        unit: "un",
        description: form.observacao || undefined,
        metadata: {
          tipo: form.tipo,
          imei: form.imei,
          imei2: form.imei2,
          disponibilidade: form.disponibilidade,
          gb: form.gb,
          serial: form.serial,
          ram: form.ram,
          cor: form.cor,
          subcategoria: form.subcategoria,
          saude_bateria: form.saude_bateria,
          ciclo_bateria: form.ciclo_bateria,
          estado: form.estado,
          margem: form.margem || margemCalc.toFixed(2),
          markup: form.markup || markupCalc.toFixed(2),
          data_entrada: form.data_entrada,
          dias_garantia: form.dias_garantia,
          valor_venda_2: form.valor_venda_2,
          valor_venda_3: form.valor_venda_3,
          valor_custo: form.valor_custo,
          quantidade: form.quantidade,
          tags: form.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean),
          tipo_fornecedor: form.tipo_fornecedor,
          ncm: form.ncm,
          cest: form.cest,
          origem: form.origem,
          peso: form.peso,
          forma_pagamento: form.forma_pagamento,
          parcelas: form.parcelas,
          contas_pagar: contasPagar,
          custos_extras: custosExtras,
          anexos: allAnexos,
          image_url: imageUrlInput?.trim() || firstImage || md.image_url,
          checklist,
          mov_tipo: form.mov_tipo,
          mov_motivo: form.mov_motivo,
          mov_obs: form.mov_obs,
          nota_id: form.nota_id || null,
        },
      };

      if (onSave) await onSave(payload as any);
      setPendingFiles([]);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar: " + (e?.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  const addExtraRow = (setter: (fn: any) => void) =>
    setter((prev: ExtraRow[]) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", amount: "", dueDate: "" },
    ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1500px] p-0 overflow-hidden h-[95vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground space-y-0">
          <DialogTitle className="text-base font-bold">
            {product ? "Editar Produto em Estoque" : "Cadastrar Produto em Estoque"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulário completo de cadastro de produto
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="h-auto rounded-none justify-start gap-0 bg-background border-b px-4 py-0">
            {[
              { v: "geral", l: "Dados gerais", i: Info },
              { v: "contas", l: "Financeiro", i: Wallet },
              { v: "anexos", l: "Anexos", i: Paperclip },
              { v: "movimentacao", l: "Movimentação de Estoque", i: ArrowLeftRight },
              { v: "checklist", l: "Checklist", i: ClipboardCheck },
              { v: "outras", l: "Outras informações", i: FileText },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3 text-xs font-semibold"
              >
                {t.l}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto px-8 py-6 bg-background">
            {/* === DADOS GERAIS === */}
            <TabsContent value="geral" className="mt-0 space-y-6">
              {/* Tipo aparelho/acessorio/peca */}
              <div className="flex justify-end">
                <div className="inline-flex rounded-md overflow-hidden border border-border">
                  {(["Aparelho", "Acessório", "Peça"] as ProductType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setProductType(t);
                        set("tipo", t);
                      }}
                      className={`px-6 py-2 text-xs font-bold transition ${
                        productType === t
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-3">
                <FieldRow label="Código">
                  <Input value={form.codigo} disabled className="bg-muted/50" />
                </FieldRow>
                <FieldRow label="SKU">
                  <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} />
                </FieldRow>

                <FieldRow label="Tipo" required>
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => {
                      if (v === "__add__") {
                        const nome = window.prompt("Nome do novo tipo:")?.trim();
                        if (!nome) return;
                        setCustomTipos((prev) =>
                          prev.includes(nome) ? prev : [...prev, nome],
                        );
                        set("tipo", nome);
                        return;
                      }
                      set("tipo", v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Novo">Novo</SelectItem>
                      <SelectItem value="Seminovo">Seminovo</SelectItem>
                      <SelectItem value="Usado">Usado</SelectItem>
                      <SelectItem value="Vitrine">Vitrine</SelectItem>
                      {customTipos.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                      <SelectItem
                        value="__add__"
                        className="text-primary font-bold border-t mt-1"
                      >
                        + Cadastrar novo tipo...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Código de Barras">
                  <div className="flex gap-2">
                    <Input value={form.ean} onChange={(e) => set("ean", e.target.value)} />
                    <Button type="button" variant="secondary" size="icon" className="shrink-0">
                      <Barcode className="h-4 w-4" />
                    </Button>
                  </div>
                </FieldRow>

                {productType === "Aparelho" && (
                  <>
                    <FieldRow label="IMEI">
                      <div className="flex gap-2">
                        <Input value={form.imei} onChange={(e) => set("imei", e.target.value)} />
                        <Button type="button" variant="secondary" size="icon" className="shrink-0">
                          <Smartphone className="h-4 w-4" />
                        </Button>
                      </div>
                    </FieldRow>
                    <FieldRow label="Disponibilidade" required>
                      <Select
                        value={form.disponibilidade}
                        onValueChange={(v) => set("disponibilidade", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Disponível para venda">Disponível para venda</SelectItem>
                          <SelectItem value="Reservado">Reservado</SelectItem>
                          <SelectItem value="Em conserto">Em conserto</SelectItem>
                          <SelectItem value="Indisponível">Indisponível</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldRow>

                    <FieldRow label="IMEI 2">
                      <div className="flex gap-2">
                        <Input value={form.imei2} onChange={(e) => set("imei2", e.target.value)} />
                        <Button type="button" variant="secondary" size="icon" className="shrink-0">
                          <Smartphone className="h-4 w-4" />
                        </Button>
                      </div>
                    </FieldRow>
                    <FieldRow label="Modelo Aparelho" required>
                      <Select
                        value={form.modelo}
                        onValueChange={(v) => {
                          if (v === "__add__") {
                            const nome = window.prompt("Nome do novo modelo:")?.trim();
                            if (!nome) return;
                            setCustomModelos((prev) =>
                              prev.includes(nome) ? prev : [...prev, nome],
                            );
                            set("modelo", nome);
                            return;
                          }
                          set("modelo", v);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Buscar modelo" />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {IPHONE_MODELS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                          {customModelos.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                          <SelectItem
                            value="__add__"
                            className="text-primary font-bold border-t mt-1"
                          >
                            + Cadastrar novo modelo...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldRow>

                    <FieldRow label="Serial number">
                      <Input value={form.serial} onChange={(e) => set("serial", e.target.value)} />
                    </FieldRow>
                    <FieldRow label="GB">
                      <Select value={form.gb} onValueChange={(v) => set("gb", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {["32", "64", "128", "256", "512", "1024"].map((g) => (
                            <SelectItem key={g} value={g}>
                              {g} GB
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldRow>

                    <FieldRow label="Cor">
                      <Select
                        value={form.cor}
                        onValueChange={(v) => {
                          if (v === "__add__") {
                            const nome = window.prompt("Nome da nova cor:")?.trim();
                            if (!nome) return;
                            setCustomCores((prev) =>
                              prev.includes(nome) ? prev : [...prev, nome],
                            );
                            set("cor", nome);
                            return;
                          }
                          set("cor", v);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar cor" />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                          {IPHONE_CORES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                          {customCores.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                          <SelectItem
                            value="__add__"
                            className="text-primary font-bold border-t mt-1"
                          >
                            + Cadastrar nova cor...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldRow>
                    <FieldRow label="Memória RAM">
                      <Select value={form.ram} onValueChange={(v) => set("ram", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {["2", "3", "4", "6", "8", "12", "16"].map((r) => (
                            <SelectItem key={r} value={r}>
                              {r} GB
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldRow>
                  </>
                )}

                {productType !== "Aparelho" && (
                  <>
                    <FieldRow label="Modelo" required>
                      <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Cor">
                      <Input value={form.cor} onChange={(e) => set("cor", e.target.value)} />
                    </FieldRow>
                  </>
                )}

                <FieldRow label="Categoria">
                  <Input
                    value={form.categoria}
                    onChange={(e) => set("categoria", e.target.value)}
                    placeholder="Selecionar"
                  />
                </FieldRow>
                <FieldRow label="Marca">
                  <Input value={form.marca} onChange={(e) => set("marca", e.target.value)} />
                </FieldRow>

                <FieldRow label="Subcategoria">
                  <Input
                    value={form.subcategoria}
                    onChange={(e) => set("subcategoria", e.target.value)}
                  />
                </FieldRow>
                {productType === "Aparelho" && (
                  <FieldRow label="Saúde bateria">
                    <Input
                      value={form.saude_bateria}
                      onChange={(e) => set("saude_bateria", e.target.value)}
                      placeholder="Ex: 92%"
                    />
                  </FieldRow>
                )}

                {productType === "Aparelho" && (
                  <>
                    <FieldRow label="Ciclo bateria">
                      <Input
                        value={form.ciclo_bateria}
                        onChange={(e) => set("ciclo_bateria", e.target.value)}
                      />
                    </FieldRow>
                    <FieldRow label="Estado do Aparelho">
                      <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Novo">Novo</SelectItem>
                          <SelectItem value="Excelente">Excelente</SelectItem>
                          <SelectItem value="Bom">Bom</SelectItem>
                          <SelectItem value="Regular">Regular</SelectItem>
                          <SelectItem value="Defeito">Defeito</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldRow>
                  </>
                )}

                <FieldRow label="Quantidade">
                  <Input
                    type="number"
                    value={form.quantidade}
                    onChange={(e) => set("quantidade", e.target.value)}
                  />
                </FieldRow>
                <FieldRow label="Quantidade mínima">
                  <Input
                    type="number"
                    value={form.quantidade_minima}
                    onChange={(e) => set("quantidade_minima", e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Valor custo" required>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_custo}
                    onChange={(e) => set("valor_custo", e.target.value)}
                  />
                </FieldRow>
                <FieldRow label="Valor venda" required>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={form.valor_venda}
                      onChange={(e) => set("valor_venda", e.target.value)}
                    />
                    <Button type="button" variant="secondary" size="icon" className="shrink-0">
                      <DollarSign className="h-4 w-4" />
                    </Button>
                  </div>
                </FieldRow>

                <FieldRow label="Lucro $">
                  <Input
                    value={lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    disabled
                    className="bg-muted/50"
                  />
                </FieldRow>
                <FieldRow label="Margem %">
                  <Input
                    value={form.margem || margemCalc.toFixed(2)}
                    onChange={(e) => set("margem", e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Mark-Up %">
                  <Input
                    value={form.markup || markupCalc.toFixed(2)}
                    onChange={(e) => set("markup", e.target.value)}
                  />
                </FieldRow>
                <div />

                <FieldRow label="Data de Entrada">
                  <div className="relative">
                    <Input
                      type="date"
                      value={form.data_entrada}
                      onChange={(e) => set("data_entrada", e.target.value)}
                    />
                  </div>
                </FieldRow>
                <FieldRow label="Dias de Garantia">
                  <Input
                    type="number"
                    value={form.dias_garantia}
                    onChange={(e) => set("dias_garantia", e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Valor venda 2">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_venda_2}
                    onChange={(e) => set("valor_venda_2", e.target.value)}
                  />
                </FieldRow>
                <FieldRow label="Valor venda 3">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_venda_3}
                    onChange={(e) => set("valor_venda_3", e.target.value)}
                  />
                </FieldRow>

                <FieldRow label="Observação" className="xl:col-span-2 xl:grid-cols-[160px_1fr]">
                  <Textarea
                    rows={3}
                    value={form.observacao}
                    onChange={(e) => set("observacao", e.target.value)}
                  />
                </FieldRow>
                <FieldRow label="Tags" className="xl:col-span-2 xl:grid-cols-[160px_1fr]">
                  <Input
                    value={form.tags}
                    onChange={(e) => set("tags", e.target.value)}
                    placeholder="Buscar (separe por vírgula)"
                  />
                </FieldRow>
              </div>

              {/* Dados do fornecedor */}
              <div className="pt-4 border-t">
                <h3 className="text-sm font-bold mb-4">Dados do fornecedor</h3>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-3">
                  <FieldRow label="Tipo de fornecedor">
                    <Select
                      value={form.tipo_fornecedor}
                      onValueChange={(v) => set("tipo_fornecedor", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="Cliente">Cliente</SelectItem>
                        <SelectItem value="Distribuidor">Distribuidor</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldRow>
                  <FieldRow label="Fornecedor">
                    <Input
                      value={form.fornecedor}
                      onChange={(e) => set("fornecedor", e.target.value)}
                      placeholder="Buscar"
                    />
                  </FieldRow>
                </div>
              </div>
            </TabsContent>

            {/* === CONTAS A PAGAR === */}
            <TabsContent value="contas" className="mt-0 space-y-6">
              <Tabs defaultValue="notas" className="w-full">
                <TabsList className="bg-muted/40 border border-border">
                  <TabsTrigger value="notas" className="data-[state=active]:bg-background data-[state=active]:text-primary text-xs font-semibold">
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> Notas & Contas
                  </TabsTrigger>
                  <TabsTrigger value="pagamento" className="data-[state=active]:bg-background data-[state=active]:text-primary text-xs font-semibold">
                    <CreditCard className="h-3.5 w-3.5 mr-1.5" /> Forma de Pagamento
                  </TabsTrigger>
                  <TabsTrigger value="custos" className="data-[state=active]:bg-background data-[state=active]:text-primary text-xs font-semibold">
                    <Coins className="h-3.5 w-3.5 mr-1.5" /> Custos extras
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="notas" className="mt-4 space-y-6">
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Nota vinculada
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Selecione a nota em aberto a que este produto pertence.
                    </p>
                    <Select value={form.nota_id || "none"} onValueChange={(v) => set("nota_id", v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar nota em aberto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {openNotas.map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {openNotas.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        Nenhuma nota em aberto encontrada. Cadastre em Financeiro › Notas.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">Contas a pagar vinculadas</h3>
                    <Button size="sm" onClick={() => addExtraRow(setContasPagar)}>
                      <Plus className="h-4 w-4 mr-1" /> Nova conta
                    </Button>
                  </div>
                  <ExtraRowTable rows={contasPagar} setRows={setContasPagar} withDate />
                </TabsContent>

                <TabsContent value="pagamento" className="mt-4">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-3 max-w-3xl">
                    <FieldRow label="Forma de Pagamento">
                      <Select
                        value={form.forma_pagamento}
                        onValueChange={(v) => set("forma_pagamento", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["À vista", "Cartão", "Pix", "Boleto", "Crédito", "Transferência"].map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldRow>
                    <FieldRow label="Parcelas">
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={form.parcelas}
                        onChange={(e) => set("parcelas", e.target.value)}
                      />
                    </FieldRow>
                  </div>
                </TabsContent>

                <TabsContent value="custos" className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">Custos adicionais</h3>
                    <Button size="sm" onClick={() => addExtraRow(setCustosExtras)}>
                      <Plus className="h-4 w-4 mr-1" /> Novo custo
                    </Button>
                  </div>
                  <ExtraRowTable rows={custosExtras} setRows={setCustosExtras} />
                </TabsContent>
              </Tabs>
            </TabsContent>


            {/* === ANEXOS === */}
            <TabsContent value="anexos" className="mt-0 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Link da foto do produto</label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://exemplo.com/foto.jpg"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                  />
                  {imageUrlInput && (
                    <button
                      type="button"
                      onClick={() => setImageUrlInput("")}
                      className="text-destructive px-2"
                      aria-label="Limpar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {imageUrlInput && (
                  <img
                    src={imageUrlInput}
                    alt="Pré-visualização"
                    className="h-32 w-32 object-cover rounded-lg border"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Cole uma URL pública da imagem. Usada como capa do produto.
                </p>
              </div>

              <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer hover:bg-muted/30 transition">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-sm font-medium">Clique para anexar arquivos</span>
                <span className="text-xs text-muted-foreground">
                  Nota fiscal, foto do produto, garantia, etc.
                </span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setPendingFiles((prev) => [...prev, ...files]);
                    setAnexos((prev) => [...prev, ...files.map((f) => ({ name: f.name }))]);
                  }}
                />
              </label>
              {anexos.length > 0 && (
                <ul className="divide-y border rounded-lg">
                  {anexos.map((a, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                      <span className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" /> {a.name}
                      </span>
                      <button
                        onClick={() => setAnexos((p) => p.filter((_, j) => j !== i))}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* === MOVIMENTAÇÃO === */}
            <TabsContent value="movimentacao" className="mt-0">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-3 max-w-3xl">
                <FieldRow label="Tipo">
                  <Select value={form.mov_tipo} onValueChange={(v) => set("mov_tipo", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="saida">Saída</SelectItem>
                      <SelectItem value="ajuste">Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Motivo">
                  <Input value={form.mov_motivo} onChange={(e) => set("mov_motivo", e.target.value)} />
                </FieldRow>
                <FieldRow label="Observação" className="xl:col-span-2">
                  <Textarea
                    rows={3}
                    value={form.mov_obs}
                    onChange={(e) => set("mov_obs", e.target.value)}
                  />
                </FieldRow>
              </div>
            </TabsContent>

            {/* === CHECKLIST === */}
            <TabsContent value="checklist" className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Checklist de conferência</h3>
                <Button
                  size="sm"
                  onClick={() =>
                    setChecklist((p) => [
                      ...p,
                      { id: crypto.randomUUID(), item: "", ok: false },
                    ])
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Novo item
                </Button>
              </div>
              <ul className="space-y-2">
                {checklist.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 border rounded-lg px-3 py-2">
                    <input
                      type="checkbox"
                      checked={c.ok}
                      onChange={(e) =>
                        setChecklist((p) =>
                          p.map((x) => (x.id === c.id ? { ...x, ok: e.target.checked } : x)),
                        )
                      }
                      className="h-4 w-4"
                    />
                    <Input
                      value={c.item}
                      onChange={(e) =>
                        setChecklist((p) =>
                          p.map((x) => (x.id === c.id ? { ...x, item: e.target.value } : x)),
                        )
                      }
                      className="border-0 shadow-none focus-visible:ring-0 px-0"
                      placeholder="Descrição do item..."
                    />
                    <button
                      onClick={() => setChecklist((p) => p.filter((x) => x.id !== c.id))}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </TabsContent>

            {/* === OUTRAS INFORMAÇÕES === */}
            <TabsContent value="outras" className="mt-0">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-10 gap-y-3 max-w-4xl">
                <FieldRow label="NCM">
                  <Input value={form.ncm} onChange={(e) => set("ncm", e.target.value)} />
                </FieldRow>
                <FieldRow label="CEST">
                  <Input value={form.cest} onChange={(e) => set("cest", e.target.value)} />
                </FieldRow>
                <FieldRow label="Origem">
                  <Select value={form.origem} onValueChange={(v) => set("origem", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 - Nacional</SelectItem>
                      <SelectItem value="1">1 - Estrangeira (Importação direta)</SelectItem>
                      <SelectItem value="2">2 - Estrangeira (Mercado interno)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <FieldRow label="Peso (kg)">
                  <Input
                    type="number"
                    step="0.001"
                    value={form.peso}
                    onChange={(e) => set("peso", e.target.value)}
                  />
                </FieldRow>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-3 border-t bg-muted/20">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar produto"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtraRowTable({
  rows,
  setRows,
  withDate,
}: {
  rows: ExtraRow[];
  setRows: React.Dispatch<React.SetStateAction<ExtraRow[]>>;
  withDate?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="border border-dashed rounded-xl p-10 text-center text-sm text-muted-foreground">
        Nenhum registro. Clique em "Novo" para adicionar.
      </div>
    );
  }
  return (
    <div className="border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase">
          <tr>
            <th className="text-left px-3 py-2">Descrição</th>
            <th className="text-left px-3 py-2 w-40">Valor</th>
            {withDate && <th className="text-left px-3 py-2 w-44">Vencimento</th>}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-2 py-1">
                <Input
                  value={r.description}
                  onChange={(e) =>
                    setRows((p) =>
                      p.map((x) => (x.id === r.id ? { ...x, description: e.target.value } : x)),
                    )
                  }
                  className="border-0 shadow-none focus-visible:ring-0"
                />
              </td>
              <td className="px-2 py-1">
                <Input
                  type="number"
                  step="0.01"
                  value={r.amount}
                  onChange={(e) =>
                    setRows((p) =>
                      p.map((x) => (x.id === r.id ? { ...x, amount: e.target.value } : x)),
                    )
                  }
                  className="border-0 shadow-none focus-visible:ring-0"
                />
              </td>
              {withDate && (
                <td className="px-2 py-1">
                  <Input
                    type="date"
                    value={r.dueDate}
                    onChange={(e) =>
                      setRows((p) =>
                        p.map((x) => (x.id === r.id ? { ...x, dueDate: e.target.value } : x)),
                      )
                    }
                    className="border-0 shadow-none focus-visible:ring-0"
                  />
                </td>
              )}
              <td className="px-2 py-1 text-right">
                <button
                  onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
