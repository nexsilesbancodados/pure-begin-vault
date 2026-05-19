import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  User,
  Package,
  ChevronRight,
  X,
  UserPlus,
  Info,
  Loader2,
  ArrowLeft,
  History,
  Calculator,
  Percent,
  Tag,
  ReceiptText,
  Printer,
  FileText,
  CheckCircle2,
  Eraser,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Calendar,
  Briefcase,
  AtSign,
  Building2,
  Truck,
  Wrench,
  IdCard,
  CalendarClock,
} from "lucide-react";
import { Product } from "@/lib/mock";
import { ProductForm } from "@/components/estoque/ProductForm";
import { PixCharge } from "@/components/vendas/PixCharge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CartItem extends Product {
  quantity: number;
  model?: string;
  capacity?: string;
  color?: string;
  battery_health?: string;
}

export function PDVInterface() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [customersList, setCustomersList] = useState<{ id: string; full_name: string }[]>([]);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [customerForm, setCustomerForm] = useState({
    categoria: "cliente" as "cliente" | "fornecedor" | "tecnico" | "motoboy",
    tipo_pessoa: "fisica" as "fisica" | "juridica",
    cpf_cnpj: "",
    nome: "",
    data_nascimento: "",
    profissao: "",
    genero: "",
    origem: "",
    telefone: "",
    telefone_alt: "",
    telefone_extra: "",
    email: "",
    instagram: "",
    cep: "",
    rua: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    complemento: "",
    observacoes: "",
    tags: "",
  });
  const updateCustomerField = <K extends keyof typeof customerForm>(
    k: K,
    v: (typeof customerForm)[K],
  ) => setCustomerForm((p) => ({ ...p, [k]: v }));
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);

  const lookupCep = async (rawCep: string) => {
    const cep = rawCep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setIsLookingUpCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      setCustomerForm((p) => ({
        ...p,
        rua: data.logradouro || p.rua,
        bairro: data.bairro || p.bairro,
        cidade: data.localidade || p.cidade,
        estado: data.uf || p.estado,
        complemento: data.complemento || p.complemento,
      }));
      toast.success("Endereço preenchido automaticamente.");
    } catch {
      toast.error("Falha ao consultar CEP.");
    } finally {
      setIsLookingUpCep(false);
    }
  };

  const resetCustomerForm = () =>
    setCustomerForm({
      categoria: "cliente",
      tipo_pessoa: "fisica",
      cpf_cnpj: "",
      nome: "",
      data_nascimento: "",
      profissao: "",
      genero: "",
      origem: "",
      telefone: "",
      telefone_alt: "",
      telefone_extra: "",
      email: "",
      instagram: "",
      cep: "",
      rua: "",
      numero: "",
      bairro: "",
      cidade: "",
      estado: "",
      complemento: "",
      observacoes: "",
      tags: "",
    });
  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("Geral");
  const [newProductStock, setNewProductStock] = useState("1");
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [moneyAmount, setMoneyAmount] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");
  const [pixAmount, setPixAmount] = useState<string>("");
  const [prazoAmount, setPrazoAmount] = useState<string>("");
  const [barcode, setBarcode] = useState("");
  const [vendedorId, setVendedorId] = useState<string>("");
  const [obs, setObs] = useState("");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [lastSaleData, setLastSaleData] = useState<any | null>(null);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [selectedCartItemId, setSelectedCartItemId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = useCallback(async () => {
    if (!user?.id || !orgId) return;
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", orgId);

      if (error) throw error;

      // Carrega IMEIs disponíveis (não vendidos) para mostrar no PDV
      const productIds = (data || []).map((p: any) => p.id);
      const imeisByProduct: Record<string, { imei: string; serial: string | null }[]> = {};
      if (productIds.length) {
        const { data: imeiRows } = await supabase
          .from("product_imei")
          .select("product_id, imei, serial, status")
          .eq("organization_id", orgId)
          .in("product_id", productIds)
          .neq("status", "sold");
        for (const row of imeiRows || []) {
          const pid = (row as any).product_id as string;
          (imeisByProduct[pid] ||= []).push({
            imei: String((row as any).imei || ""),
            serial: (row as any).serial ? String((row as any).serial) : null,
          });
        }
      }

      const formattedProducts: Product[] = (data || []).map((p) => {
        const product: Product = {
          id: p.id,
          name: p.name,
          category: p.category || "Geral",
          price: p.price || 0,
          stock: p.stock_quantity || 0,
          description: p.description || "",
          image: p.image_url || undefined,
        };

        if (p.model) (product as any).model = p.model;
        if ((p as any).brand) (product as any).brand = (p as any).brand;
        if ((p as any).sku) (product as any).sku = (p as any).sku;
        const meta = (p as any).metadata || {};
        if (meta.capacity) (product as any).capacity = meta.capacity;
        if (meta.color) (product as any).color = meta.color;
        if (meta.battery_health) (product as any).battery_health = meta.battery_health;
        const imei = meta.imei || meta.IMEI || meta.imei1 || (p as any).imei || null;
        const imei2 = meta.imei2 || null;
        const serial = meta.serial || meta.serial_number || null;
        const condition = meta.condition || meta.condicao || null;
        if (imei) (product as any).imei = String(imei);
        if (imei2) (product as any).imei2 = String(imei2);
        if (serial) (product as any).serial = String(serial);
        if (condition) (product as any).condition = String(condition);

        return product;
      });

      setAllProducts(formattedProducts);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar catálogo de produtos.");
    } finally {
      setLoadingProducts(false);
    }
  }, [user?.id, orgId]);

  const fetchCustomers = useCallback(async () => {
    if (!user?.id || !orgId) return;
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name")
        .limit(200);

      if (error) throw error;
      setCustomersList((data || []).map((c: any) => ({ id: c.id, full_name: c.name })));
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
  }, [user?.id, orgId]);

  const handlePrintReceipt = (saleData?: any) => {
    const data = saleData || lastSaleData;
    if (!data) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = data.items
      .map(
        (item: any) => `
      <tr>
        <td style="padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
          <div style="font-weight: bold;">${item.name}</div>
          <div style="font-size: 10px; color: #666;">
            ${item.model ? `Mod: ${item.model}` : ""} 
            ${item.capacity ? `| Cap: ${item.capacity}` : ""}
          </div>
        </td>
        <td style="text-align: right; padding: 6px 0; border-bottom: 1px solid #f0f0f0;">
          ${item.quantity}x<br>
          <strong>${(item.price * item.quantity).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>
        </td>
      </tr>
    `,
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Cupom de Venda - #${data.id?.slice(0, 8)}</title>
          <style>
            body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; line-height: 1.4; width: 280px; margin: 0 auto; padding: 15px; color: #000; }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .store-name { font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -1px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .section-title { font-weight: 800; text-transform: uppercase; font-size: 9px; color: #666; margin-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; }
            .total-area { margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .grand-total { font-size: 16px; font-weight: 900; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 9px; color: #666; font-style: italic; }
            @media print { body { width: 100%; padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="store-name">${data.storeInfo?.name}</h1>
            <p style="margin: 2px 0;">${data.storeInfo?.address}</p>
            <p style="margin: 2px 0;">CNPJ: ${data.storeInfo?.cnpj}</p>
            <p style="margin: 2px 0;">Fone: ${data.storeInfo?.phone}</p>
          </div>
          
          <div class="section">
            <div class="section-title">Comprovante de Venda</div>
            <div style="display: flex; justify-content: space-between;">
              <span>Nº Pedido: <strong>#${data.id?.slice(0, 8).toUpperCase()}</strong></span>
              <span>Data: ${data.data?.split(",")[0]}</span>
            </div>
            <p style="margin: 2px 0;">Vendedor: ${data.vendedor}</p>
          </div>

          <div class="divider"></div>

          <div class="section">
            <div class="section-title">Cliente</div>
            <p style="margin: 0; font-weight: bold;">${data.customer?.name || "Consumidor Final"}</p>
            ${data.customer?.phone ? `<p style="margin: 0;">Tel: ${data.customer.phone}</p>` : ""}
          </div>

          <div class="divider"></div>

          <div class="section">
            <div class="section-title">Itens do Pedido</div>
            <table>
              ${itemsHtml}
            </table>
          </div>

          <div class="total-area">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${((data.total || 0) + (data.discount || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
            ${
              data.discount > 0
                ? `
              <div class="total-row" style="color: #d00;">
                <span>Desconto:</span>
                <span>-${data.discount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            `
                : ""
            }
            <div class="total-row grand-total">
              <span>TOTAL:</span>
              <span>${(data.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
            <p style="margin: 8px 0 0 0; font-size: 9px; font-weight: bold;">
              FORMA DE PAGTO: ${data.paymentMethod}
            </p>
          </div>

          <div class="footer">
            <p>Este documento não é nota fiscal.</p>
            <p>Obrigado pela preferência!</p>
            <p><strong>Acesse: www.applejau.com.br</strong></p>
          </div>
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px; width: 100%; cursor: pointer;">Imprimir</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintWarranty = (type: "seminovo" | "lacrado" | "android", saleData?: any) => {
    const data = saleData || lastSaleData;
    if (!data) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const warrantyTime = type === "seminovo" ? "7 meses" : "1 ano";
    const typeLabel =
      type === "seminovo"
        ? "iPhone Seminovo"
        : type === "lacrado"
          ? "iPhone Lacrado"
          : "Aparelho Android";

    const itemsHtml = data.items
      .map(
        (item: any) => `
      <div style="border: 1px solid #e0e0e0; padding: 12px; margin-bottom: 10px; border-radius: 8px; background: #fafafa;">
        <div style="font-size: 14px; font-weight: bold; color: #000; margin-bottom: 5px;">${item.name}</div>
        <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 5px; font-size: 11px;">
          ${item.model ? `<div><strong>Modelo:</strong> ${item.model}</div>` : ""}
          ${item.capacity ? `<div><strong>Capacidade:</strong> ${item.capacity}</div>` : ""}
          ${item.color ? `<div><strong>Cor:</strong> ${item.color}</div>` : ""}
          ${item.battery_health ? `<div><strong>Saúde Bateria:</strong> ${item.battery_health}%</div>` : ""}
          <div style="grid-column: span 2; margin-top: 4px; border-top: 1px solid #eee; pt: 4px;">
            <strong>ID/IMEI/SÉRIE:</strong> <span style="font-family: monospace;">${item.id || "N/A"}</span>
          </div>
        </div>
      </div>
    `,
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Termo de Garantia - ${typeLabel}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 30px; color: #222; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .store-info { text-align: right; font-size: 11px; }
            .doc-title { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -1px; }
            .section { margin-bottom: 25px; }
            .section-header { background: #000; color: #fff; padding: 5px 12px; font-weight: 900; text-transform: uppercase; font-size: 11px; border-radius: 4px; margin-bottom: 12px; }
            .customer-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
            .info-card { border: 1px solid #eee; padding: 15px; border-radius: 8px; }
            .terms-list { padding-left: 20px; }
            .terms-list li { margin-bottom: 8px; }
            .signatures { display: grid; grid-template-cols: 1fr 1fr; gap: 60px; margin-top: 80px; text-align: center; }
            .sig-box { border-top: 2px solid #000; padding-top: 10px; }
            .footer-info { text-align: center; margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="doc-title">TERMO DE<br>GARANTIA</div>
              <div style="color: #666; font-weight: bold; margin-top: 5px;">${typeLabel.toUpperCase()}</div>
            </div>
            <div class="store-info">
              <div style="font-size: 16px; font-weight: 900;">${data.storeInfo?.name}</div>
              <div>CNPJ: ${data.storeInfo?.cnpj}</div>
              <div>${data.storeInfo?.phone}</div>
              <div>${data.storeInfo?.address}</div>
            </div>
          </div>

          <div class="customer-grid">
            <div class="info-card">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #888; margin-bottom: 5px;">Dados do Cliente</div>
              <div style="font-size: 14px; font-weight: bold;">${data.customer?.name || "Consumidor Final"}</div>
              <div>CPF/CNPJ: ${data.customer?.document || "N/A"}</div>
              <div>Telefone: ${data.customer?.phone || "N/A"}</div>
              <div>Endereço: ${data.customer?.address || "N/A"}</div>
            </div>
            <div class="info-card">
              <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #888; margin-bottom: 5px;">Dados da Venda</div>
              <div>Nº Pedido: <strong>#${data.id?.slice(0, 8).toUpperCase()}</strong></div>
              <div>Data da Compra: ${data.data?.split(",")[0]}</div>
              <div>Vendedor: ${data.vendedor}</div>
              <div><strong>Prazo de Garantia: ${warrantyTime}</strong></div>
            </div>
          </div>

          <div class="section">
            <div class="section-header">1. Identificação do Produto</div>
            ${itemsHtml}
          </div>

          <div class="section">
            <div class="section-header">2. Condições Gerais e Cobertura</div>
            <p>O aparelho acima descrito possui garantia legal e contratual totalizando o prazo de <strong>${warrantyTime}</strong>. Esta garantia cobre exclusivamente defeitos de fabricação ou vícios ocultos nos componentes internos do aparelho que impeçam seu funcionamento normal.</p>
            <ul class="terms-list">
              <li><strong>iPhones Seminovos:</strong> A bateria possui garantia de 3 meses se apresentar saúde inferior a 80%.</li>
              <li><strong>Aparelhos Novos:</strong> A garantia é de 1 ano diretamente com o fabricante ou conforme CDC.</li>
            </ul>
          </div>

          <div class="section">
            <div class="section-header">3. Exclusões (Perda Total de Garantia)</div>
            <p>A garantia será automaticamente <strong>INVALIDADA</strong> nos seguintes casos:</p>
            <ul class="terms-list">
              <li>Danos causados por queda, impacto, pressão ou mau uso (telas quebradas ou riscadas);</li>
              <li>Contato com líquidos (oxidação), mesmo em aparelhos resistentes à água;</li>
              <li>Uso de carregadores, cabos ou acessórios não originais/homologados;</li>
              <li>Aparelho aberto ou reparado por assistência técnica não autorizada;</li>
              <li>Modificações de software (Jailbreak, Root) ou bloqueios de iCloud/Google;</li>
              <li>Remoção ou violação do selo de garantia da loja.</li>
            </ul>
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div style="font-weight: bold;">Assinatura do Cliente</div>
              <div style="font-size: 10px;">Confirmo o recebimento em perfeito estado</div>
            </div>
            <div class="sig-box">
              <div style="font-weight: bold;">${data.storeInfo?.name}</div>
              <div style="font-size: 10px;">Carimbo e Assinatura do Responsável</div>
            </div>
          </div>

          <div class="footer-info">
            Jaú, ${new Date().toLocaleDateString("pt-BR")} - Este documento é indispensável para acionamento da garantia.
          </div>

          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="padding: 12px 24px; background: #000; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">IMPRIMIR TERMO DE GARANTIA</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchProducts();
      await fetchCustomers();

      // Lógica para lidar com parâmetros de URL (Impressão e Visualização)
      const urlParams = new URLSearchParams(window.location.search);
      const saleId = urlParams.get("id") || urlParams.get("view") || urlParams.get("edit");
      const isEditing = urlParams.has("edit");
      const action = urlParams.get("print");
      const warrantyType = urlParams.get("type") as "seminovo" | "lacrado" | "android" | null;

      if (saleId && user?.id) {
        try {
          const { data: sale, error } = await supabase
            .from("sales_orders")
            .select("*, customers(*), sale_items(*)")
            .eq("id", saleId)
            .single();

          if (error) throw error;

          const storeConfig = {
            name: "APPLE JAU",
            cnpj: "54.123.456/0001-89",
            phone: "(14) 99876-5432",
            address: "Rua Major Prado, 123 - Centro, Jaú - SP",
          };

          const items = ((sale as any).sale_items || []).map((it: any) => ({
            id: it.product_id || it.id,
            name: it.product_name,
            price: Number(it.unit_price) || 0,
            quantity: Number(it.quantity) || 1,
            ...(it.metadata || {}),
          }));

          const saleSnapshot: any = {
            id: sale.id,
            items,
            total: sale.total_amount || 0,
            discount: (sale as any).discount || 0,
            customer: (sale as any).customers
              ? {
                  id: (sale as any).customers.id,
                  name: (sale as any).customers.name,
                  phone: (sale as any).customers.phone,
                  document: (sale as any).customers.document,
                  address: [(sale as any).customers.address, (sale as any).customers.city]
                    .filter(Boolean)
                    .join(" - "),
                }
              : null,
            paymentMethod: (sale as any).payment_method || "Não informado",
            vendedor: "Sistema",
            data: new Date(sale.created_at || new Date()).toLocaleString("pt-BR"),
            storeInfo: storeConfig,
          };

          setLastSaleId(sale.id);
          setLastSaleData(saleSnapshot);

          if (action === "receipt") {
            setTimeout(() => {
              handlePrintReceipt(saleSnapshot);
            }, 500);
          } else if (action === "warranty") {
            setTimeout(() => {
              handlePrintWarranty(warrantyType || "seminovo", saleSnapshot);
            }, 500);
          } else if (isEditing) {
            setEditingSaleId(sale.id);
            setSelectedCustomer(
              (sale as any).customers
                ? { id: (sale as any).customers.id, name: (sale as any).customers.name }
                : null,
            );
            setCart(items);
            setDiscountValue((sale as any).discount || 0);
            toast.success("Venda carregada para edição");
          }
        } catch (err) {
          console.error("Erro ao carregar venda via URL:", err);
        }
      }
    };
    loadData();
  }, [fetchProducts, fetchCustomers, user?.id]);

  const [activeCategory, setActiveCategory] = useState<string>("all");
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const [customerSearch, setCustomerSearch] = useState("");

  // Atalhos de Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2: Focar Busca de Produtos
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F1: Focar Código de Barras
      if (e.key === "F1") {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }
      // F4: Focar Vendedor
      if (e.key === "F4") {
        e.preventDefault();
        const vendorSelect = document.querySelector("select");
        vendorSelect?.focus();
      }
      // F8: Abrir Checkout (se carrinho não estiver vazio)
      if (e.key === "F8" && cart.length > 0) {
        e.preventDefault();
        if (!selectedCustomer) {
          setIsCustomerModalOpen(true);
        } else {
          setIsCheckoutModalOpen(true);
        }
      }
      // F9: Vincular Cliente
      if (e.key === "F9") {
        e.preventDefault();
        setIsCustomerModalOpen(true);
      }
      // F10: Finalizar (se tudo OK)
      if (e.key === "F10" && cart.length > 0 && paymentMethod) {
        e.preventDefault();
        if (!selectedCustomer) {
          setIsCustomerModalOpen(true);
        } else {
          setIsCheckoutModalOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.length, paymentMethod, selectedCustomer]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => {
      const q = search.toLowerCase();
      const pa = p as any;
      const haystack = [
        p.name,
        p.category,
        p.id,
        pa.brand,
        pa.model,
        pa.color,
        pa.capacity,
        pa.imei,
        pa.imei2,
        pa.serial,
        pa.sku,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !search || haystack.includes(q);

      if (!matchesSearch) return false;
      if (activeCategory === "all") return true;

      const catMap: Record<string, string[]> = {
        phones: ["Smartphones", "Celulares", "Aparelhos"],
        acc: ["Acessórios", "Películas", "Cabos", "Fones", "Carregadores"],
        services: ["Serviços", "Mão de Obra"],
      };
      const allowedCats = catMap[activeCategory] || [];
      return allowedCats.some((c) => p.category.toLowerCase().includes(c.toLowerCase()));
    });
  }, [search, allProducts, activeCategory]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customersList;
    const s = customerSearch.toLowerCase();
    return customersList.filter((c) => c.full_name.toLowerCase().includes(s));
  }, [customerSearch, customersList]);

  const handleBarcodeSearch = (code: string) => {
    if (!code) return;
    const c = code.trim();
    const product = allProducts.find((p) => {
      const pa = p as any;
      return (
        p.id === c ||
        pa.sku === c ||
        pa.imei === c ||
        pa.imei2 === c ||
        pa.serial === c ||
        (p.name && p.name.toLowerCase().includes(c.toLowerCase()))
      );
    });
    if (product) {
      addToCart(product);
      setBarcode("");
      toast.success(`Produto adicionado: ${product.name}`);
    } else {
      toast.error("Produto não encontrado com este código.");
    }
  };

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
    setSearch("");
    searchInputRef.current?.focus();
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((current) =>
      current.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      }),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((current) => current.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (confirm("Tem certeza que deseja limpar o carrinho?")) {
      setCart([]);
      setPaymentMethod(null);
      toast.success("Carrinho limpo");
    }
  };

  const subtotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cart],
  );
  const total = useMemo(() => subtotal - discountValue, [subtotal, discountValue]);

  const totalReceived = useMemo(() => {
    return (
      (parseFloat(moneyAmount) || 0) +
      (parseFloat(cardAmount) || 0) +
      (parseFloat(pixAmount) || 0) +
      (parseFloat(prazoAmount) || 0)
    );
  }, [moneyAmount, cardAmount, pixAmount, prazoAmount]);

  const change = useMemo(() => Math.max(0, totalReceived - total), [totalReceived, total]);

  const handleCheckoutKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && totalReceived >= total && !isFinishing && selectedCustomer) {
      handleFinishSale();
    }
  };

  const handleFinishSale = async () => {
    if (!user?.id) return;

    if (!selectedCustomer) {
      toast.error("Cliente obrigatório", {
        description: "Por favor, identifique o cliente antes de finalizar a venda.",
      });
      setIsCustomerModalOpen(true);
      return;
    }

    setIsFinishing(true);

    const usedMethods = [];
    if (parseFloat(moneyAmount) > 0) usedMethods.push("Dinheiro");
    if (parseFloat(cardAmount) > 0) usedMethods.push("Cartão");
    if (parseFloat(pixAmount) > 0) usedMethods.push("PIX");
    if (parseFloat(prazoAmount) > 0) usedMethods.push("Prazo 7 dias");

    const finalPaymentMethod =
      usedMethods.length > 1
        ? "Múltiplo (" + usedMethods.join(", ") + ")"
        : usedMethods[0] ||
          (paymentMethod === "money"
            ? "Dinheiro"
            : paymentMethod === "card"
              ? "Cartão"
              : paymentMethod === "pix"
                ? "PIX"
                : "Não informado");

    try {
      // Snapshot do cliente para o recibo
      let customerDetails: {
        id?: string;
        name: string;
        phone?: string;
        document?: string;
        address?: string;
      } | null = selectedCustomer ? { name: selectedCustomer.name, id: selectedCustomer.id } : null;
      if (selectedCustomer?.id) {
        const { data: fullCustomer } = await supabase
          .from("customers")
          .select("*")
          .eq("id", selectedCustomer.id)
          .single();
        if (fullCustomer) {
          customerDetails = {
            id: fullCustomer.id,
            name: fullCustomer.name,
            phone: fullCustomer.phone || undefined,
            document: fullCustomer.document || undefined,
            address: [fullCustomer.address, fullCustomer.city].filter(Boolean).join(" - "),
          };
        }
      }

      const subtotal = cart.reduce((s, it) => s + it.price * it.quantity, 0);
      const payments: any[] = [];
      const moneyN = parseFloat(moneyAmount) || 0;
      const cardN = parseFloat(cardAmount) || 0;
      const pixN = parseFloat(pixAmount) || 0;
      const prazoN = parseFloat(prazoAmount) || 0;
      if (moneyN > 0) payments.push({ method: "cash", amount: moneyN });
      if (cardN > 0) payments.push({ method: "card", amount: cardN });
      if (pixN > 0) payments.push({ method: "pix", amount: pixN });
      if (prazoN > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        payments.push({
          method: "credit",
          amount: prazoN,
          due_date: dueDate.toISOString(),
          term_days: 7,
          label: "Prazo 7 dias",
        });
      }
      if (payments.length === 0) {
        const fallback =
          paymentMethod === "money"
            ? "cash"
            : paymentMethod === "card"
              ? "card"
              : paymentMethod === "pix"
                ? "pix"
                : "cash";
        payments.push({ method: fallback, amount: total });
      }

      let saleId: string | null = null;

      if (editingSaleId) {
        // Edição mantém o fluxo legado simples (não refaz baixa de estoque)
        const { data, error } = await supabase
          .from("sales_orders")
          .update({
            customer_id: selectedCustomer?.id || null,
            total_amount: total,
            subtotal,
            discount: discountValue,
            payment_method: finalPaymentMethod,
            notes: null,
          })
          .eq("id", editingSaleId)
          .select()
          .single();
        if (error || !data) throw error || new Error("Falha ao atualizar venda");
        saleId = data.id;
      } else {
        const { data, error } = await supabase.rpc("checkout_sale", {
          _payload: {
            customer_id: selectedCustomer?.id || null,
            total,
            subtotal,
            discount: discountValue,
            addition: 0,
            payment_method: finalPaymentMethod,
            channel: "pdv",
            items: cart.map((item) => ({
              product_id: item.id,
              product_name: item.name,
              sku: (item as any).sku,
              quantity: item.quantity,
              unit_price: item.price,
              unit_cost: (item as any).cost_price,
              total: item.price * item.quantity,
              imei: (item as any).imei || null,
              metadata: {
                model: item.model,
                capacity: item.capacity,
                color: item.color,
                battery_health: item.battery_health,
              },
            })),
            payments,
          },
        });
        if (error || !data) throw error || new Error("Falha ao processar venda");
        saleId = data as unknown as string;
      }

      const storeConfig = {
        name: "APPLE JAU",
        cnpj: "54.123.456/0001-89",
        phone: "(14) 99876-5432",
        address: "Rua Major Prado, 123 - Centro, Jaú - SP",
      };

      const saleSnapshot = {
        id: saleId,
        items: [...cart],
        total: total,
        discount: discountValue,
        customer: customerDetails,
        paymentMethod: finalPaymentMethod,
        vendedor: user?.email?.split("@")[0] || "Sistema",
        data: new Date().toLocaleString("pt-BR"),
        storeInfo: storeConfig,
      };

      toast.success(
        editingSaleId ? "Venda atualizada com sucesso!" : "Venda finalizada com sucesso!",
        {
          description: `Total de ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        },
      );

      setCart([]);
      setPaymentMethod(null);
      setSelectedCustomer(null);
      setIsCheckoutModalOpen(false);
      setMoneyAmount("");
      setCardAmount("");
      setPixAmount("");
      setPrazoAmount("");
      setDiscountValue(0);
      setEditingSaleId(null);
      setLastSaleId(saleId);
      setLastSaleData(saleSnapshot);
      setIsSuccessModalOpen(true);
      fetchProducts();
    } catch (error: any) {
      console.error("Erro ao finalizar venda:", error);
      toast.error("Erro ao processar a venda: " + (error?.message || ""));
    } finally {
      setIsFinishing(false);
    }
  };
  const handleSaveNewProduct = async (formData: any) => {
    if (!user?.id || !orgId) return toast.error("Organização não encontrada");

    setIsCreatingProduct(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .insert({
          user_id: user.id,
          organization_id: orgId,
          name: formData.name,
          sku: formData.sku || null,
          ean: formData.ean || null,
          ncm: formData.ncm || null,
          reference: formData.reference || null,
          category: formData.category || "Geral",
          brand: formData.brand || null,
          supplier: formData.supplier || null,
          model: formData.model || null,
          price: Number(formData.price || 0),
          wholesale_price: Number(formData.wholesale_price || 0),
          cost_price: Number(formData.cost_price || 0),
          stock_quantity: Number(formData.stock || 0),
          min_stock: Number(formData.min_stock || 0),
          unit: formData.unit || "un",
          weight: Number(formData.weight || 0),
          location: formData.location || null,
          description: formData.description || null,
          image_url: formData.image_url || null,
          metadata: {
            store: formData.store,
            imei: formData.imei,
            imei2: formData.imei2,
            color: formData.color,
            capacity: formData.capacity,
            processor: formData.processor,
            ram: formData.ram,
            display: formData.display,
            battery_health: formData.battery_health,
            observations: formData.observations,
          },
        })
        .select()
        .single();

      if (error) throw error;

      const formattedProduct: Product = {
        id: data.id,
        name: data.name,
        category: data.category || "Geral",
        price: data.price || 0,
        stock: data.stock_quantity || 0,
        description: data.description || "",
      };
      const meta = (data as any).metadata || {};
      if (data.model) (formattedProduct as any).model = data.model;
      if (meta.capacity) (formattedProduct as any).capacity = meta.capacity;
      if (meta.color) (formattedProduct as any).color = meta.color;
      if (meta.battery_health) (formattedProduct as any).battery_health = meta.battery_health;

      toast.success("Produto cadastrado com sucesso!");
      addToCart(formattedProduct);
      setIsNewProductModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      console.error("Erro ao criar produto:", error);
      toast.error("Erro ao cadastrar produto: " + (error?.message || ""));
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!user?.id || !orgId) return;
    const f = customerForm;
    const nome = (f.nome || newCustomerName).trim();
    if (!nome) {
      toast.error("Informe o nome.");
      return;
    }
    const enderecoCompleto = [
      f.rua,
      f.numero && `nº ${f.numero}`,
      f.bairro,
      f.complemento,
    ]
      .filter(Boolean)
      .join(", ");
    const extras = {
      categoria: f.categoria,
      tipo_pessoa: f.tipo_pessoa,
      data_nascimento: f.data_nascimento || undefined,
      profissao: f.profissao || undefined,
      genero: f.genero || undefined,
      origem: f.origem || undefined,
      telefone_alt: f.telefone_alt || undefined,
      telefone_extra: f.telefone_extra || undefined,
      instagram: f.instagram || undefined,
      cep: f.cep || undefined,
      tags: f.tags || undefined,
      observacoes: f.observacoes || undefined,
    };
    const notesPayload = JSON.stringify(extras);
    setIsCreatingCustomer(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          user_id: user.id,
          organization_id: orgId,
          name: nome,
          phone: f.telefone || newCustomerPhone || null,
          email: f.email || null,
          document: f.cpf_cnpj || null,
          address: enderecoCompleto || null,
          city: f.cidade || null,
          state: f.estado || null,
          notes: notesPayload,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Cliente cadastrado com sucesso!");
      setSelectedCustomer({ id: data.id, name: data.name });
      setIsNewCustomerModalOpen(false);
      setIsCustomerModalOpen(false);
      resetCustomerForm();
      setNewCustomerName("");
      setNewCustomerPhone("");
      fetchCustomers();
    } catch (error: any) {
      console.error("Erro ao criar cliente:", error);
      toast.error("Erro ao cadastrar cliente.");
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full lg:h-[calc(100vh-140px)] animate-in fade-in duration-500 overflow-y-auto lg:overflow-hidden p-2 sm:p-0">
      {/* Header de Ações Rápidas */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-5 border border-primary/20 rounded-2xl shadow-sm">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="relative flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full xl:hidden"
              onClick={() => history.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/30">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                Frente de Caixa
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest bg-success/15 text-success font-bold px-2 py-0.5 rounded-md border border-success/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Online
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Terminal 01 • {user?.email?.split("@")[0] || "Usuário"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex flex-col items-end px-3 py-1.5 rounded-xl bg-card/80 backdrop-blur border border-border/60">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Carrinho
              </span>
              <span className="text-sm font-black text-primary">
                {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex gap-2 bg-card/80 backdrop-blur"
              onClick={() => navigate({ to: "/vendas/historico" })}
            >
              <History className="h-4 w-4" /> Histórico
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex gap-2 bg-card/80 backdrop-blur"
              onClick={() => navigate({ to: "/vendas/calculadora" })}
            >
              <Calculator className="h-4 w-4" /> Calculadora
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_450px] gap-4 sm:gap-6 flex-1 overflow-visible lg:overflow-hidden">
        <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Finalizar Venda</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total a Pagar</Label>
                  <div className="text-2xl font-black text-primary">
                    {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <Label>Troco</Label>
                  <div className="text-2xl font-black text-success">
                    {change.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <Banknote className="h-3 w-3" /> Dinheiro
                    </Label>
                    <div className="relative" ref={searchContainerRef}>
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                        R$
                      </span>
                      <Input
                        type="number"
                        placeholder="0,00"
                        className="pl-8 h-10 font-bold text-sm"
                        value={moneyAmount}
                        onChange={(e) => setMoneyAmount(e.target.value)}
                        onKeyDown={handleCheckoutKeyDown}
                        autoFocus={paymentMethod === "money"}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <CreditCard className="h-3 w-3" /> Cartão
                    </Label>
                    <div className="relative" ref={searchContainerRef}>
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                        R$
                      </span>
                      <Input
                        type="number"
                        placeholder="0,00"
                        className="pl-8 h-10 font-bold text-sm"
                        value={cardAmount}
                        onChange={(e) => setCardAmount(e.target.value)}
                        onKeyDown={handleCheckoutKeyDown}
                        autoFocus={paymentMethod === "card"}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <QrCode className="h-3 w-3" /> PIX
                    </Label>
                    <div className="relative" ref={searchContainerRef}>
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                        R$
                      </span>
                      <Input
                        type="number"
                        placeholder="0,00"
                        className="pl-8 h-10 font-bold text-sm"
                        value={pixAmount}
                        onChange={(e) => setPixAmount(e.target.value)}
                        onKeyDown={handleCheckoutKeyDown}
                        autoFocus={paymentMethod === "pix"}
                      />
                    </div>
                  </div>
                </div>

                {parseFloat(pixAmount) > 0 && (
                  <PixCharge
                    amount={parseFloat(pixAmount)}
                    txId={`PDV${Date.now().toString().slice(-10)}`}
                    description={
                      selectedCustomer?.name ? `Venda ${selectedCustomer.name}` : "Venda PDV"
                    }
                  />
                )}

                <div className="bg-muted/50 p-4 rounded-xl space-y-2 border border-border">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Bruto:</span>
                      <span className="font-bold text-foreground">
                        {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    {discountValue > 0 && (
                      <div className="flex justify-between items-center text-sm text-destructive font-medium">
                        <span>Desconto Aplicado:</span>
                        <span>
                          -
                          {discountValue.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-base font-black border-t border-border/50 pt-2 mt-1">
                      <span className="text-primary uppercase text-xs">Total Líquido:</span>
                      <span className="text-primary text-xl">
                        {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 space-y-1 border-t border-border/50">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total Recebido:</span>
                      <span className="font-black text-foreground">
                        {totalReceived.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground italic">
                        {totalReceived >= total ? "Troco a devolver:" : "Ainda resta:"}
                      </span>
                      <span
                        className={`font-bold ${totalReceived >= total ? "text-success" : "text-destructive"}`}
                      >
                        {Math.abs(total - totalReceived).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span
                      className={`font-bold ${!selectedCustomer ? "text-destructive animate-pulse" : ""}`}
                    >
                      {selectedCustomer?.name || "Não Identificado"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCheckoutModalOpen(false)}
                disabled={isFinishing}
              >
                Voltar
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 min-w-[180px] font-bold"
                onClick={handleFinishSale}
                disabled={totalReceived < total || isFinishing || !selectedCustomer}
              >
                {isFinishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Confirmar Recebimento"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
          <DialogContent className="sm:max-w-[400px] text-center">
            <DialogHeader>
              <DialogTitle className="flex flex-col items-center gap-2">
                <div className="h-16 w-16 bg-success/10 text-success rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                Venda Realizada!
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <p className="text-muted-foreground text-sm">
                A venda foi processada e registrada com sucesso no sistema.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  className="w-full gap-2 h-12 font-bold"
                  onClick={() => handlePrintReceipt()}
                >
                  <Printer className="h-4 w-4" /> Imprimir Recibo
                </Button>
                {lastSaleId && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 h-12 font-bold"
                    onClick={async () => {
                      const url = `${window.location.origin}/recibo/${lastSaleId}`;
                      await navigator.clipboard.writeText(url);
                      toast.success("Link copiado", { description: url });
                      window.open(url, "_blank");
                    }}
                  >
                    <ReceiptText className="h-4 w-4" /> Cupom online (compartilhável)
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full gap-2 h-12 font-bold">
                      <FileText className="h-4 w-4" />
                      Imprimir Termo
                      <ChevronDown className="h-4 w-4 ml-auto opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[350px]" align="end">
                    <DropdownMenuItem
                      className="cursor-pointer py-3 font-semibold"
                      onClick={() => handlePrintWarranty("seminovo")}
                    >
                      iPhone Seminovo (7 meses de garantia)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer py-3 font-semibold"
                      onClick={() => handlePrintWarranty("lacrado")}
                    >
                      iPhone Lacrado (1 ano de garantia)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer py-3 font-semibold"
                      onClick={() => handlePrintWarranty("android")}
                    >
                      Aparelho Android (1 ano de garantia)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setIsSuccessModalOpen(false)}
              >
                Fechar e Iniciar Nova Venda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vincular Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="relative" ref={searchContainerRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente por nome..."
                  className="pl-9"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-[250px] rounded-md border p-4">
                <div className="space-y-2">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer({ id: customer.id, name: customer.full_name });
                          setIsCustomerModalOpen(false);
                          toast.info(`Cliente ${customer.full_name} vinculado.`);
                        }}
                        className="w-full text-left p-3 hover:bg-muted rounded-lg border border-transparent hover:border-border transition flex items-center justify-between group"
                      >
                        <div className="font-medium">{customer.full_name}</div>
                        <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 transition" />
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Nenhum cliente encontrado.
                    </div>
                  )}
                </div>
              </ScrollArea>
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={() => {
                  setIsNewCustomerModalOpen(true);
                  setNewCustomerName(customerSearch);
                }}
              >
                <UserPlus className="h-4 w-4" /> Cadastrar Novo Cliente
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ProductForm
          open={isNewProductModalOpen}
          onOpenChange={setIsNewProductModalOpen}
          onSave={handleSaveNewProduct}
        />

        <Dialog open={isNewCustomerModalOpen} onOpenChange={setIsNewCustomerModalOpen}>
          <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden p-0 gap-0 border-0 shadow-2xl">
            {/* HEADER com gradiente + avatar */}
            <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/70 px-6 py-5">
              <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
              <div className="relative flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-primary-foreground text-xl font-bold shadow-lg ring-2 ring-white/30">
                  {(customerForm.nome || "?").trim().charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <DialogHeader className="space-y-0.5">
                    <DialogTitle className="text-primary-foreground text-xl font-bold">
                      {customerForm.nome.trim() || "Cadastro de Pessoa"}
                    </DialogTitle>
                    <p className="text-primary-foreground/80 text-xs">
                      Preencha os dados para criar e vincular o cliente à venda atual.
                    </p>
                  </DialogHeader>
                </div>
              </div>

              {/* Categoria pills + Tipo pessoa */}
              <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-xl bg-white/15 backdrop-blur-sm p-1 gap-1">
                  {(
                    [
                      { key: "cliente", label: "Cliente", Icon: User },
                      { key: "fornecedor", label: "Fornecedor", Icon: Building2 },
                      { key: "tecnico", label: "Técnico", Icon: Wrench },
                      { key: "motoboy", label: "Motoboy", Icon: Truck },
                    ] as const
                  ).map(({ key, label, Icon }) => {
                    const active = customerForm.categoria === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateCustomerField("categoria", key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          active
                            ? "bg-white text-primary shadow"
                            : "text-primary-foreground/90 hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="inline-flex rounded-xl bg-white/15 backdrop-blur-sm p-1 gap-1">
                  {(
                    [
                      { key: "fisica", label: "Pessoa Física" },
                      { key: "juridica", label: "Pessoa Jurídica" },
                    ] as const
                  ).map(({ key, label }) => {
                    const active = customerForm.tipo_pessoa === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateCustomerField("tipo_pessoa", key)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          active
                            ? "bg-white text-primary shadow"
                            : "text-primary-foreground/90 hover:bg-white/10"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* BODY */}
            <div className="overflow-y-auto max-h-[calc(92vh-220px)] bg-muted/20">
              <Tabs defaultValue="gerais" className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b bg-background px-6 p-0 h-auto sticky top-0 z-10">
                  {[
                    { v: "gerais", label: "Dados gerais", Icon: User },
                    { v: "endereco", label: "Endereço", Icon: MapPin },
                    { v: "adicionais", label: "Dados adicionais", Icon: FileText },
                    { v: "telefones", label: "Telefones extras", Icon: Phone },
                  ].map(({ v, label, Icon }) => (
                    <TabsTrigger
                      key={v}
                      value={v}
                      className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-4 py-3 text-xs font-semibold"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* DADOS GERAIS */}
                <TabsContent value="gerais" className="p-6 space-y-5 mt-0">
                  <div className="bg-background rounded-2xl border p-5 space-y-4 shadow-sm">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      <IdCard className="h-3.5 w-3.5" /> Identificação
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-7 space-y-1.5">
                        <Label className="text-xs font-medium">
                          Nome completo <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={customerForm.nome}
                            onChange={(e) => updateCustomerField("nome", e.target.value)}
                            placeholder="Ex: João Silva"
                            maxLength={120}
                          />
                        </div>
                      </div>
                      <div className="md:col-span-5 space-y-1.5">
                        <Label className="text-xs font-medium">
                          {customerForm.tipo_pessoa === "juridica" ? "CNPJ" : "CPF"}
                        </Label>
                        <div className="relative">
                          <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={customerForm.cpf_cnpj}
                            onChange={(e) => updateCustomerField("cpf_cnpj", e.target.value)}
                            placeholder={
                              customerForm.tipo_pessoa === "juridica"
                                ? "00.000.000/0000-00"
                                : "000.000.000-00"
                            }
                            maxLength={20}
                          />
                        </div>
                      </div>
                      <div className="md:col-span-4 space-y-1.5">
                        <Label className="text-xs font-medium">Data de nascimento</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="date"
                            className="pl-9"
                            value={customerForm.data_nascimento}
                            onChange={(e) =>
                              updateCustomerField("data_nascimento", e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="md:col-span-4 space-y-1.5">
                        <Label className="text-xs font-medium">Profissão</Label>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={customerForm.profissao}
                            onChange={(e) => updateCustomerField("profissao", e.target.value)}
                            maxLength={80}
                          />
                        </div>
                      </div>
                      <div className="md:col-span-4 space-y-1.5">
                        <Label className="text-xs font-medium">Gênero</Label>
                        <select
                          value={customerForm.genero}
                          onChange={(e) => updateCustomerField("genero", e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        >
                          <option value="">Selecionar</option>
                          <option value="masculino">Masculino</option>
                          <option value="feminino">Feminino</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                      <div className="md:col-span-12 space-y-1.5">
                        <Label className="text-xs font-medium">Origem do cliente</Label>
                        <select
                          value={customerForm.origem}
                          onChange={(e) => updateCustomerField("origem", e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        >
                          <option value="">Como conheceu a loja?</option>
                          <option value="indicacao">Indicação</option>
                          <option value="instagram">Instagram</option>
                          <option value="google">Google</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="loja">Loja física</option>
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-background rounded-2xl border p-5 space-y-4 shadow-sm">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" /> Contato
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Telefone / WhatsApp</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                          <Input
                            className="pl-9"
                            value={customerForm.telefone}
                            onChange={(e) => updateCustomerField("telefone", e.target.value)}
                            placeholder="(11) 99999-9999"
                            maxLength={20}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            className="pl-9"
                            value={customerForm.email}
                            onChange={(e) => updateCustomerField("email", e.target.value)}
                            placeholder="cliente@email.com"
                            maxLength={120}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Telefone alternativo</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={customerForm.telefone_alt}
                            onChange={(e) => updateCustomerField("telefone_alt", e.target.value)}
                            maxLength={20}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Instagram</Label>
                        <div className="relative">
                          <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={customerForm.instagram}
                            onChange={(e) =>
                              updateCustomerField(
                                "instagram",
                                e.target.value.replace(/^@?/, "@"),
                              )
                            }
                            placeholder="@usuario"
                            maxLength={40}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ENDEREÇO */}
                <TabsContent value="endereco" className="p-6 space-y-5 mt-0">
                  <div className="bg-background rounded-2xl border p-5 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" /> Endereço
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        Digite o CEP para preencher automaticamente
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-4 space-y-1.5">
                        <Label className="text-xs font-medium">CEP</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9 pr-9"
                            value={customerForm.cep}
                            onChange={(e) => updateCustomerField("cep", e.target.value)}
                            onBlur={(e) => lookupCep(e.target.value)}
                            placeholder="00000-000"
                            maxLength={10}
                          />
                          {isLookingUpCep && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-6 space-y-1.5">
                        <Label className="text-xs font-medium">Rua</Label>
                        <Input
                          value={customerForm.rua}
                          onChange={(e) => updateCustomerField("rua", e.target.value)}
                          maxLength={150}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <Label className="text-xs font-medium">Número</Label>
                        <Input
                          value={customerForm.numero}
                          onChange={(e) => updateCustomerField("numero", e.target.value)}
                          maxLength={10}
                        />
                      </div>
                      <div className="md:col-span-5 space-y-1.5">
                        <Label className="text-xs font-medium">Bairro</Label>
                        <Input
                          value={customerForm.bairro}
                          onChange={(e) => updateCustomerField("bairro", e.target.value)}
                          maxLength={80}
                        />
                      </div>
                      <div className="md:col-span-5 space-y-1.5">
                        <Label className="text-xs font-medium">Cidade</Label>
                        <Input
                          value={customerForm.cidade}
                          onChange={(e) => updateCustomerField("cidade", e.target.value)}
                          maxLength={80}
                        />
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <Label className="text-xs font-medium">UF</Label>
                        <Input
                          value={customerForm.estado}
                          onChange={(e) =>
                            updateCustomerField(
                              "estado",
                              e.target.value.toUpperCase().slice(0, 2),
                            )
                          }
                          maxLength={2}
                          placeholder="SP"
                        />
                      </div>
                      <div className="md:col-span-12 space-y-1.5">
                        <Label className="text-xs font-medium">Complemento</Label>
                        <Input
                          value={customerForm.complemento}
                          onChange={(e) => updateCustomerField("complemento", e.target.value)}
                          placeholder="Apto, bloco, referência..."
                          maxLength={120}
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* DADOS ADICIONAIS */}
                <TabsContent value="adicionais" className="p-6 space-y-5 mt-0">
                  <div className="bg-background rounded-2xl border p-5 space-y-4 shadow-sm">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" /> Notas e tags
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Observações</Label>
                        <textarea
                          value={customerForm.observacoes}
                          onChange={(e) => updateCustomerField("observacoes", e.target.value)}
                          rows={6}
                          maxLength={1000}
                          placeholder="Preferências, histórico, observações internas..."
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none"
                        />
                        <p className="text-[11px] text-muted-foreground text-right">
                          {customerForm.observacoes.length}/1000
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Tags</Label>
                        <div className="relative">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={customerForm.tags}
                            onChange={(e) => updateCustomerField("tags", e.target.value)}
                            placeholder="vip, atacado, fiel"
                            maxLength={200}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Separe as tags por vírgula.
                        </p>
                        {customerForm.tags.trim() && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {customerForm.tags
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean)
                              .map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px]">
                                  {t}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* TELEFONES EXTRAS */}
                <TabsContent value="telefones" className="p-6 space-y-5 mt-0">
                  <div className="bg-background rounded-2xl border p-5 space-y-4 shadow-sm">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" /> Telefones adicionais
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Telefone alternativo</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={customerForm.telefone_alt}
                            onChange={(e) => updateCustomerField("telefone_alt", e.target.value)}
                            maxLength={20}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Telefone extra</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            value={customerForm.telefone_extra}
                            onChange={(e) =>
                              updateCustomerField("telefone_extra", e.target.value)
                            }
                            maxLength={20}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* FOOTER sticky */}
            <DialogFooter className="px-6 py-3 border-t bg-background flex-row items-center justify-between gap-2 sm:justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetCustomerForm}
                  disabled={isCreatingCustomer}
                  className="gap-1.5 text-muted-foreground"
                >
                  <Eraser className="h-4 w-4" /> Limpar
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  disabled={isCreatingCustomer}
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" /> Voltar
                </Button>
                <Button
                  onClick={handleCreateCustomer}
                  disabled={!customerForm.nome.trim() || isCreatingCustomer}
                  className="gap-1.5 bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 min-w-[180px]"
                >
                  {isCreatingCustomer ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Salvar e Vincular
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lado Esquerdo: Seleção de Produtos e Campos de Venda */}
        <div className="flex flex-col gap-4 overflow-hidden animate-in slide-in-from-left duration-500">
          {/* Barra Superior de Busca e Campos */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-card border border-border rounded-2xl p-4 shadow-sm">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Código (F1)
              </Label>
              <div className="relative" ref={searchContainerRef}>
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  ref={barcodeInputRef}
                  placeholder="Código de barras"
                  className="pl-9 h-11 bg-muted/20"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBarcodeSearch(barcode)}
                />
              </div>
            </div>

            <div className="md:col-span-6 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Produto (F2)
              </Label>
              <div className="relative" ref={searchContainerRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar por nome, IMEI, série ou cor..."
                  className="pl-9 h-11 bg-muted/20"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  autoFocus
                />
                {(search === "" || search || loadingProducts) && isSearchFocused && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 border border-border rounded-xl shadow-2xl overflow-hidden bg-card">
                    <div className="max-h-[300px] overflow-y-auto">
                      {loadingProducts ? (
                        <div className="p-8 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : filteredProducts.length > 0 ? (
                        filteredProducts.slice(0, 50).map((product) => (
                          <button
                            key={product.id}
                            onClick={() => {
                              addToCart(product);
                              setIsSearchFocused(false);
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-primary/5 transition text-left border-b border-border last:border-none"
                          >
                            <div className="flex-1 min-w-0 flex flex-col">
                              <div className="font-bold text-sm truncate">{product.name}</div>
                              {(() => {
                                const pa = product as any;
                                const chips: string[] = [];
                                if (pa.capacity) chips.push(String(pa.capacity));
                                if (pa.color) chips.push(String(pa.color));
                                if (pa.condition) chips.push(String(pa.condition).toUpperCase());
                                if (pa.battery_health) chips.push(`Bat ${pa.battery_health}%`);
                                return chips.length ? (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {chips.map((c, i) => (
                                      <span
                                        key={i}
                                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                                      >
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                              {(product as any).imei && (
                                <div className="text-[10px] font-mono text-foreground/80 mt-0.5 truncate">
                                  IMEI: {(product as any).imei}
                                  {(product as any).imei2 ? ` / ${(product as any).imei2}` : ""}
                                </div>
                              )}
                              {!((product as any).imei) && (product as any).serial && (
                                <div className="text-[10px] font-mono text-foreground/80 mt-0.5 truncate">
                                  SN: {(product as any).serial}
                                </div>
                              )}
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Estoque: {product.stock}
                              </div>
                            </div>
                            <div className="font-black text-sm text-primary">
                              {product.price.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="p-6 text-center text-muted-foreground italic text-sm">
                          Produto não encontrado.
                        </div>
                      )}
                    </div>
                    <div className="p-2 border-t border-border bg-muted/20">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full gap-2 text-xs font-bold"
                        onClick={() => {
                          setNewProductName(search);
                          setIsNewProductModalOpen(true);
                          setIsSearchFocused(false);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Cadastrar "{search || "Novo"}"
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Categoria
              </Label>
              <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
                <TabsList className="grid grid-cols-4 h-11 bg-muted/40 p-1 rounded-xl">
                  <TabsTrigger
                    value="all"
                    className="text-[10px] font-black uppercase tracking-tighter"
                  >
                    Geral
                  </TabsTrigger>
                  <TabsTrigger
                    value="phones"
                    className="text-[10px] font-black uppercase tracking-tighter"
                  >
                    Smart
                  </TabsTrigger>
                  <TabsTrigger
                    value="acc"
                    className="text-[10px] font-black uppercase tracking-tighter"
                  >
                    Acess
                  </TabsTrigger>
                  <TabsTrigger
                    value="services"
                    className="text-[10px] font-black uppercase tracking-tighter"
                  >
                    Serv
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Observações da Venda */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Vendedor (F4)
              </Label>
              <div className="relative min-w-[200px]">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
                <select
                  className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/30 border-none text-[13px] font-bold focus:outline-none focus:ring-1 focus:ring-primary/20 appearance-none"
                  value={vendedorId}
                  onChange={(e) => setVendedorId(e.target.value)}
                >
                  <option value="">Selecione um vendedor</option>
                  <option value="1">Vendedor Padrão</option>
                  <option value={user?.id}>Eu ({user?.email?.split("@")[0]})</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div className="pt-2 border-t border-border/50">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 block italic">
                Observações da Venda
              </Label>
              <textarea
                className="w-full h-12 bg-muted/10 border border-input border-dashed rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none placeholder:text-muted-foreground/30"
                placeholder="Instruções internas ou detalhes do pedido..."
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden mt-2">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-3.5 w-3.5" />
                </div>
                Catálogo de Produtos
              </h3>
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-2 font-bold text-[10px] uppercase bg-primary shadow-glow hover:scale-[1.02] transition-all"
                onClick={() => {
                  setNewProductName("");
                  setIsNewProductModalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Cadastrar Novo
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 py-2 pr-4 pb-4">
                {allProducts
                  .filter(
                    (p) =>
                      activeCategory === "all" ||
                      (activeCategory === "phones" &&
                        ["Smartphones", "Celulares", "Aparelhos"].some((c) =>
                          p.category.includes(c),
                        )) ||
                      (activeCategory === "acc" &&
                        ["Acessórios", "Películas", "Cabos", "Fones", "Carregadores"].some((c) =>
                          p.category.includes(c),
                        )) ||
                      (activeCategory === "services" &&
                        ["Serviços", "Mão de Obra"].some((c) => p.category.includes(c))),
                  )
                  .slice(0, 30)
                  .map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        addToCart(product);
                        setIsSearchFocused(false);
                      }}
                      disabled={product.stock <= 0}
                      title={
                        (product as any).imei
                          ? `IMEI: ${(product as any).imei}`
                          : product.name
                      }
                      className={`min-h-[112px] p-2 rounded-2xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition flex flex-col items-center justify-between gap-1 font-medium group relative ${product.stock <= 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-muted group-hover:bg-primary/10 grid place-items-center transition shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <span className="text-[11px] leading-tight text-center px-1 line-clamp-2 font-semibold">
                        {product.name}
                      </span>
                      {(() => {
                        const pa = product as any;
                        const chips: string[] = [];
                        if (pa.capacity) chips.push(String(pa.capacity));
                        if (pa.color) chips.push(String(pa.color));
                        return chips.length ? (
                          <div className="flex flex-wrap gap-0.5 justify-center">
                            {chips.slice(0, 2).map((c, i) => (
                              <span
                                key={i}
                                className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-primary/10 text-primary leading-none"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                      {(product as any).imei && (
                        <span className="text-[8px] font-mono text-foreground/70 truncate max-w-full px-1">
                          IMEI: …{String((product as any).imei).slice(-6)}
                        </span>
                      )}
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-primary">
                          {product.price.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                        <span
                          className={`text-[8px] uppercase font-bold ${product.stock <= 5 ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          Estoque: {product.stock}
                        </span>
                      </div>
                      {product.stock <= 0 && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-2xl">
                          <span className="bg-destructive text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">
                            Esgotado
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Lado Direito: Carrinho e Checkout */}
        <div className="bg-card border border-border rounded-2xl flex flex-col shadow-xl overflow-hidden animate-in slide-in-from-right duration-500">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 font-bold text-lg">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <span>Carrinho</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest">
                {cart.length} itens
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              onClick={clearCart}
              title="Limpar Carrinho"
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-4">
            <div className="py-4 space-y-3">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div
                    key={item.id}
                    onClick={() =>
                      setSelectedCartItemId(selectedCartItemId === item.id ? null : item.id)
                    }
                    className={`group relative bg-card border rounded-2xl p-3 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer ${
                      selectedCartItemId === item.id
                        ? "border-primary ring-1 ring-primary/20 bg-primary/5"
                        : "border-border/40 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Avatar do Produto ou Ícone */}
                      <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-primary/5 transition-colors">
                        <Package className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-start">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                              {item.name}
                            </span>

                            {/* Detalhes do Aparelho (Modelo, Gigas, Cor, Saúde) */}
                            {(item.model || item.capacity || item.color || item.battery_health) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.model && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] h-4 px-1.5 py-0 bg-muted/30 border-muted-foreground/20 text-muted-foreground font-medium"
                                  >
                                    {item.model}
                                  </Badge>
                                )}
                                {item.capacity && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] h-4 px-1.5 py-0 bg-primary/5 border-primary/20 text-primary font-bold"
                                  >
                                    {item.capacity}
                                  </Badge>
                                )}
                                {item.color && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] h-4 px-1.5 py-0 bg-muted/30 border-muted-foreground/20 text-muted-foreground"
                                  >
                                    {item.color}
                                  </Badge>
                                )}
                                {item.battery_health && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] h-4 px-1.5 py-0 bg-green-500/5 border-green-500/20 text-green-600 font-bold"
                                  >
                                    🔋 {item.battery_health}%
                                  </Badge>
                                )}
                              </div>
                            )}

                            {item.description && (
                              <p
                                className={`text-[10px] text-muted-foreground leading-tight mt-1 italic ${
                                  selectedCartItemId === item.id ? "" : "line-clamp-1"
                                }`}
                              >
                                {item.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromCart(item.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                              Unitário
                            </span>
                            <span className="text-sm font-semibold text-primary">
                              {item.price.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {/* Seletor de Quantidade Moderno */}
                            <div className="flex items-center bg-muted/40 rounded-full border border-border/30 p-1 ring-1 ring-transparent group-hover:ring-primary/10 transition-all">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(item.id, -1);
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-background hover:text-primary hover:shadow-sm transition-all active:scale-90"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="w-8 text-center text-xs font-black">
                                {item.quantity}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(item.id, 1);
                                }}
                                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-background hover:text-primary hover:shadow-sm transition-all active:scale-90"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>

                            {/* Total do Item */}
                            <div className="flex flex-col items-end min-w-[70px]">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight text-right">
                                Subtotal
                              </span>
                              <span className="text-sm font-black text-foreground">
                                {(item.price * item.quantity).toLocaleString("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-center animate-in fade-in zoom-in duration-500">
                  <div className="relative mb-4">
                    <ShoppingCart className="h-16 w-16 opacity-10" />
                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary/20 rounded-full animate-ping" />
                  </div>
                  <p className="font-bold text-base text-foreground/70">Carrinho Vazio</p>
                  <p className="text-xs max-w-[180px] mt-1 leading-relaxed">
                    Selecione produtos ao lado para iniciar uma nova venda
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-4 text-primary font-bold"
                    onClick={() => document.querySelector("input")?.focus()}
                  >
                    Pesquisar agora (F2)
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-5 bg-card border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.04)] space-y-4 relative z-10">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                  <ReceiptText className="h-3 w-3" /> Subtotal Bruto
                </span>
                <span className="font-bold text-foreground/80">
                  {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Desconto (R$)
                </span>
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">
                    R$
                  </span>
                  <Input
                    type="number"
                    className="h-7 pl-7 pr-1 text-[11px] font-bold bg-muted/30 border-none text-right"
                    placeholder="0,00"
                    value={discountValue || ""}
                    onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div className="relative pt-4 mt-2 border-t border-dashed border-border">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-card px-3 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                  Total a Receber
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-[10px] font-bold uppercase">Total da Venda</span>
                    <span className="text-sm font-bold">
                      {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-foreground/60 uppercase">
                      {totalReceived >= total ? "Troco" : "Restante"}
                    </span>
                    <span
                      className={`text-3xl font-black tracking-tight ${totalReceived >= total ? "text-success" : "text-primary"}`}
                    >
                      {Math.abs(total - totalReceived).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    id: "money",
                    icon: Banknote,
                    label: "Dinheiro",
                    color: "text-green-600",
                    bg: "bg-green-500/10",
                  },
                  {
                    id: "card",
                    icon: CreditCard,
                    label: "Cartão",
                    color: "text-blue-600",
                    bg: "bg-blue-500/10",
                  },
                  {
                    id: "pix",
                    icon: QrCode,
                    label: "PIX",
                    color: "text-purple-600",
                    bg: "bg-purple-500/10",
                  },
                  {
                    id: "prazo",
                    icon: CalendarClock,
                    label: "Prazo 7d",
                    color: "text-amber-600",
                    bg: "bg-amber-500/10",
                  },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => {
                      setPaymentMethod(method.id);
                      // Auto-preencher se nada foi digitado
                      if (totalReceived === 0) {
                        if (method.id === "money") setMoneyAmount(total.toFixed(2));
                        if (method.id === "card") setCardAmount(total.toFixed(2));
                        if (method.id === "pix") setPixAmount(total.toFixed(2));
                        if (method.id === "prazo") setPrazoAmount(total.toFixed(2));
                      }
                    }}
                    className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition text-[11px] font-bold uppercase
                      ${
                        paymentMethod === method.id
                          ? `border-primary ${method.bg} ${method.color}`
                          : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                  >
                    {(method.id === "money" && parseFloat(moneyAmount) > 0) ||
                    (method.id === "card" && parseFloat(cardAmount) > 0) ||
                    (method.id === "pix" && parseFloat(pixAmount) > 0) ||
                    (method.id === "prazo" && parseFloat(prazoAmount) > 0) ? (
                      <div className="absolute -top-2 -right-2 h-5 w-5 bg-primary text-white text-[10px] rounded-full flex items-center justify-center border-2 border-card">
                        ✓
                      </div>
                    ) : null}
                    <method.icon className="h-5 w-5" />
                    {method.label}
                  </button>
                ))}
              </div>

              {paymentMethod && (
                <div className="animate-in slide-in-from-top-2 duration-300">
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {paymentMethod === "money" && <Banknote className="h-4 w-4 text-primary" />}
                      {paymentMethod === "card" && <CreditCard className="h-4 w-4 text-primary" />}
                      {paymentMethod === "pix" && <QrCode className="h-4 w-4 text-primary" />}
                      {paymentMethod === "prazo" && (
                        <CalendarClock className="h-4 w-4 text-amber-600" />
                      )}
                      <span className="text-xs font-bold text-muted-foreground">R$</span>
                    </div>
                    <Input
                      type="number"
                      className="pl-16 h-12 text-lg font-black bg-primary/5 border-primary/20 focus-visible:ring-primary/30 rounded-xl"
                      placeholder="0,00"
                      autoFocus
                      value={
                        paymentMethod === "money"
                          ? moneyAmount
                          : paymentMethod === "card"
                            ? cardAmount
                            : paymentMethod === "pix"
                              ? pixAmount
                              : paymentMethod === "prazo"
                                ? prazoAmount
                                : ""
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (paymentMethod === "money") setMoneyAmount(val);
                        if (paymentMethod === "card") setCardAmount(val);
                        if (paymentMethod === "pix") setPixAmount(val);
                        if (paymentMethod === "prazo") setPrazoAmount(val);
                      }}
                    />
                    <button
                      onClick={() => {
                        if (paymentMethod === "money") setMoneyAmount("");
                        if (paymentMethod === "card") setCardAmount("");
                        if (paymentMethod === "pix") setPixAmount("");
                        if (paymentMethod === "prazo") setPrazoAmount("");
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {paymentMethod === "prazo" && parseFloat(prazoAmount) > 0 && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-700">
                      <CalendarClock className="h-3.5 w-3.5" />
                      Vencimento em{" "}
                      {new Date(Date.now() + 7 * 86400000).toLocaleDateString("pt-BR")} · será
                      lançado em Contas a Receber.
                    </div>
                  )}
                  <div className="flex justify-between items-center px-1 mt-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium italic">
                      Informe o valor recebido em{" "}
                      {paymentMethod === "money"
                        ? "dinheiro"
                        : paymentMethod === "card"
                          ? "cartão"
                          : paymentMethod === "pix"
                            ? "PIX"
                            : "prazo (7 dias)"}
                    </p>
                    {totalReceived > 0 && totalReceived < total && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[9px] font-bold text-primary hover:bg-primary/5 p-0 px-2"
                        onClick={() => {
                          const currentVal =
                            parseFloat(
                              paymentMethod === "money"
                                ? moneyAmount
                                : paymentMethod === "card"
                                  ? cardAmount
                                  : paymentMethod === "pix"
                                    ? pixAmount
                                    : prazoAmount,
                            ) || 0;
                          const remaining = (total - (totalReceived - currentVal)).toFixed(2);
                          if (paymentMethod === "money") setMoneyAmount(remaining);
                          if (paymentMethod === "card") setCardAmount(remaining);
                          if (paymentMethod === "pix") setPixAmount(remaining);
                          if (paymentMethod === "prazo") setPrazoAmount(remaining);
                        }}
                      >
                        Completar Restante
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button
              disabled={cart.length === 0 || !paymentMethod}
              onClick={() => {
                if (!selectedCustomer) {
                  toast.error("Identifique o cliente", {
                    description: "O cadastro do cliente é obrigatório para realizar vendas.",
                  });
                  setIsCustomerModalOpen(true);
                  return;
                }
                setIsCheckoutModalOpen(true);
              }}
              className={`w-full h-16 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black text-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 ${!selectedCustomer && cart.length > 0 && paymentMethod ? "ring-2 ring-destructive ring-offset-2" : ""}`}
            >
              FINALIZAR (F10)
            </Button>

            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className={`w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-tighter transition-all py-2 border border-dashed rounded-xl ${
                selectedCustomer
                  ? "text-primary border-primary/50 bg-primary/5 hover:border-primary"
                  : "text-destructive border-destructive/50 hover:bg-destructive/5 hover:border-destructive"
              }`}
            >
              <User className="h-3 w-3" />
              {selectedCustomer ? (
                <span className="font-bold">{selectedCustomer.name}</span>
              ) : (
                "Identificar Cliente (Obrigatório)"
              )}
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
