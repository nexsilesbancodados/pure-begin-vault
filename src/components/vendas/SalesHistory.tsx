import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toProductCode } from "@/lib/product-code";
import { buildReceiptItemDescription } from "@/lib/receipt-format";
import {
  Search,
  Filter,
  Download,
  MoreHorizontal,
  ShoppingBag,
  Eye,
  Printer,
  Edit,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  MessageSquare,
  Share2,
  ReceiptText,
  Info,
  Repeat2,
  Folder,
  Truck,
  PenLine,
  Mail,
  CreditCard,
  ShieldCheck,
  Package,
  Hash,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ReceiptData = {
  sale: any;
  items: any[];
  payments: any[];
  org_name: string;
  org: {
    address?: string | null;
    cnpj?: string | null;
    phone?: string | null;
    website?: string | null;
    logo_url?: string | null;
  };
  seller?: { name?: string | null } | null;
  customer?: any | null;
};

const printReceiptArea = async (mode: "a4" | "80mm") => {
  const node = document.querySelector(".receipt-print-area") as HTMLElement | null;
  if (!node) {
    window.print();
    return;
  }

  const clone = node.cloneNode(true) as HTMLElement;
  const originalImages = Array.from(node.querySelectorAll<HTMLImageElement>("img"));
  const clonedImages = Array.from(clone.querySelectorAll<HTMLImageElement>("img"));

  await Promise.all(
    clonedImages.map(async (img, index) => {
      const original = originalImages[index];
      const source = original?.currentSrc || original?.src || img.src;
      if (!source) return;

      try {
        const response = await fetch(source, { mode: "cors", cache: "force-cache" });
        if (!response.ok) throw new Error("Logo não carregou");
        const blob = await response.blob();
        img.src = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch {
        img.src = source;
      }
    }),
  );

  const isThermal = mode === "80mm";
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const printDocument = iframe.contentDocument;
  const printWindow = iframe.contentWindow;
  if (!printDocument || !printWindow) {
    iframe.remove();
    window.print();
    return;
  }

  printDocument.open();
  printDocument.write(`<!doctype html><html><head><title>Recibo</title>
    <style>
      @page { margin: ${isThermal ? "0" : "10mm"}; size: ${isThermal ? "80mm auto" : "A4"}; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: 'Courier New', ui-monospace, monospace; }
      img { display: block !important; max-width: 100% !important; object-fit: contain; }
      table { border-collapse: collapse; width: 100%; }
      th, td { vertical-align: top; }
      .receipt-print-area { margin: 0 auto !important; box-shadow: none !important; background: #fff !important; color: #000 !important; ${isThermal ? "width: 80mm !important; padding: 4mm !important;" : "width: 100% !important; max-width: 820px !important;"} }
      .receipt-logo { max-height: 55px !important; margin: 4px auto !important; }
      .text-center { text-align: center; } .text-left { text-align: left; } .text-right { text-align: right; }
      .font-bold { font-weight: 700; } .font-black { font-weight: 900; } .uppercase { text-transform: uppercase; }
      .mx-auto { margin-left: auto; margin-right: auto; } .my-1 { margin-top: 4px; margin-bottom: 4px; }
      .mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; } .mt-3 { margin-top: 12px; } .mt-6 { margin-top: 24px; }
      .pt-1 { padding-top: 4px; } .pt-2 { padding-top: 8px; } .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; } .pr-1 { padding-right: 4px; }
      .w-full { width: 100%; } .w-7 { width: 28px; } .w-10 { width: 40px; } .w-12 { width: 48px; } .w-14 { width: 56px; }
      .border-t { border-top: 1px solid #000; } .border-b { border-bottom: 1px solid #000; } .border-black { border-color: #000; }
      .border-dashed { border-style: dashed; } .flex { display: flex; } .justify-between { justify-content: space-between; }
      .break-words { overflow-wrap: anywhere; word-break: break-word; }
      .text-\\[10px\\] { font-size: 10px; } .text-\\[10\\.5px\\] { font-size: 10.5px; } .text-\\[11px\\] { font-size: 11px; } .text-\\[12px\\] { font-size: 12px; } .text-\\[13px\\] { font-size: 13px; }
    </style></head><body>${clone.outerHTML}</body></html>`);
  printDocument.close();

  await Promise.all(
    Array.from(printDocument.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = img.onerror = resolve;
          }),
    ),
  );

  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    window.setTimeout(() => iframe.remove(), 1000);
  }, 300);
};

const downloadNodeAsPdf = async (
  node: HTMLElement,
  filename: string,
  opts: { format?: "a4" | "thermal" } = {},
) => {
  const { default: html2canvas } = await import("html2canvas");
  const { default: jsPDF } = await import("jspdf");

  const canvas = await html2canvas(node, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  const isThermal = opts.format === "thermal";
  const pdf = isThermal
    ? new jsPDF({ orientation: "p", unit: "mm", format: [80, (canvas.height * 80) / canvas.width] })
    : new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = isThermal ? 0 : 10;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (isThermal || imgH <= pageH - margin * 2) {
    pdf.addImage(imgData, "JPEG", margin, margin, imgW, imgH);
  } else {
    // multi-page split
    let remaining = imgH;
    let position = margin;
    const pageInner = pageH - margin * 2;
    while (remaining > 0) {
      pdf.addImage(imgData, "JPEG", margin, position, imgW, imgH);
      remaining -= pageInner;
      if (remaining > 0) {
        pdf.addPage();
        position = margin - (imgH - remaining);
      }
    }
  }
  pdf.save(filename);
};

const downloadReceiptAsPdf = async (mode: "a4" | "80mm", saleLabel: string) => {
  const node = document.querySelector(".receipt-print-area") as HTMLElement | null;
  if (!node) return;
  await downloadNodeAsPdf(node, `recibo-${saleLabel}.pdf`, {
    format: mode === "80mm" ? "thermal" : "a4",
  });
};

const downloadIframeAsPdf = async (iframe: HTMLIFrameElement, filename: string) => {
  const doc = iframe.contentDocument;
  const body = doc?.body;
  if (!body) return;
  await downloadNodeAsPdf(body, filename);
};



const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  money: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
  credit: "Cartão crédito",
  debit: "Cartão débito",
  installment: "Parcelado",
  transfer: "Transferência",
};

const formatCurrency = (value: number) =>
  `R$ ${Number(value || 0)
    .toFixed(2)
    .replace(".", ",")}`;

export function SalesHistory() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsItems, setDetailsItems] = useState<any[]>([]);
  const [detailsItemsLoading, setDetailsItemsLoading] = useState(false);
  const [productDetail, setProductDetail] = useState<any | null>(null);
  const [productDetailLoading, setProductDetailLoading] = useState(false);

  const openProductDetail = useCallback(async (item: any) => {
    setProductDetail({ item, product: null });
    setProductDetailLoading(true);
    try {
      if (item?.product_id) {
        const { data } = await (supabase as any)
          .from("products")
          .select("*")
          .eq("id", item.product_id)
          .eq("organization_id", item.organization_id || orgId)
          .maybeSingle();
        setProductDetail({ item, product: data || null });
      }
    } finally {
      setProductDetailLoading(false);
    }
  }, [orgId]);

  const openSaleDetails = useCallback(async (sale: any) => {
    setSelectedSale(sale);
    setIsDetailsOpen(true);
    setDetailsItems([]);
    setDetailsItemsLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id)
        .eq("organization_id", sale.organization_id);
      setDetailsItems(Array.isArray(data) ? data : []);
    } finally {
      setDetailsItemsLoading(false);
    }
  }, []);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptMode, setReceiptMode] = useState<"a4" | "80mm">("a4");
  const [pendingReceiptPrint, setPendingReceiptPrint] = useState<"a4" | "80mm" | null>(null);
  const [warrantyDoc, setWarrantyDoc] = useState<{ title: string; html: string } | null>(null);
  const [warrantyLoading, setWarrantyLoading] = useState(false);
  const warrantyIframeRef = useRef<HTMLIFrameElement | null>(null);

  const fetchSales = useCallback(async () => {
    if (!user?.id || !orgId) {
      setSales([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = data || [];
      const customerIds = Array.from(new Set(rows.map((r: any) => r.customer_id).filter(Boolean)));
      let customersMap: Record<string, { name: string }> = {};
      if (customerIds.length) {
        const { data: cs } = await supabase
          .from("customers")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", customerIds as string[]);
        customersMap = Object.fromEntries((cs || []).map((c: any) => [c.id, { name: c.name }]));
      }
      setSales(rows.map((r: any) => ({ ...r, customers: customersMap[r.customer_id] || null })));
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
      toast.error("Erro ao carregar histórico de vendas.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, orgId]);

  useEffect(() => {
    fetchSales();

    if (!user?.id || !orgId) return;

    // Inscrever em mudanças na tabela sales_orders para atualização automática
    const channel = supabase
      .channel("sales-history-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales_orders",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          fetchSales();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSales, user?.id, orgId]);

  useEffect(() => {
    if (!pendingReceiptPrint || receiptLoading || !receiptData) return;

    const timer = window.setTimeout(() => {
      void printReceiptArea(pendingReceiptPrint);
      setPendingReceiptPrint(null);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pendingReceiptPrint, receiptData, receiptLoading]);

  const filteredSales = sales.filter((sale) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      !s ||
      sale.id.toLowerCase().includes(s) ||
      sale.customers?.name?.toLowerCase().includes(s) ||
      sale.payment_method?.toLowerCase().includes(s);
    if (!matchesSearch) return false;
    if (statusFilter !== "all" && sale.status !== statusFilter) return false;
    if (periodFilter !== "all") {
      const d = new Date(sale.created_at);
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (periodFilter === "today" && d < today) return false;
      if (periodFilter === "7d" && d < new Date(now.getTime() - 7 * 86400000)) return false;
      if (periodFilter === "30d" && d < new Date(now.getTime() - 30 * 86400000)) return false;
      if (
        periodFilter === "month" &&
        (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear())
      )
        return false;
    }
    return true;
  });

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todaySales = sales.filter((s) => new Date(s.created_at).toDateString() === today);
    const totalRevenue = sales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);

    return {
      todayTotal: todaySales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0),
      todayCount: todaySales.length,
      avgTicket: sales.length > 0 ? totalRevenue / sales.length : 0,
      canceledCount: sales.filter((s) => ["canceled", "cancelled"].includes(s.status)).length,
      totalCount: sales.length,
      totalRevenue,
    };
  }, [sales]);

  const openWarrantyPrint = useCallback(
    async (sale: any, type: "seminovo" | "lacrado" | "android") => {
      if (!orgId) throw new Error("Loja ativa não encontrada");
      try {
        // Carrega dados completos da venda + organização + cliente + vendedor
        const [saleRes, itemsRes, paymentsRes] = await Promise.all([
          (supabase as any).from("sales_orders").select("*").eq("id", sale.id).eq("organization_id", orgId).maybeSingle(),
          (supabase as any).from("sale_items").select("*").eq("sale_id", sale.id).eq("organization_id", orgId),
          (supabase as any).from("sale_payments").select("*").eq("sale_id", sale.id).eq("organization_id", orgId),
        ]);
        const fullSale = saleRes.data || sale;
        const [{ data: org }, { data: orgSettings }, { data: customer }, { data: seller }] =
          await Promise.all([
            fullSale.organization_id
              ? (supabase as any)
                  .from("organizations")
                  .select("name")
                  .eq("id", fullSale.organization_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            fullSale.organization_id
              ? (supabase as any)
                  .from("organization_settings")
                  .select("*")
                  .eq("organization_id", fullSale.organization_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            fullSale.customer_id
              ? (supabase as any)
                  .from("customers")
                  .select("*")
                  .eq("id", fullSale.customer_id)
                  .eq("organization_id", orgId)
                  .maybeSingle()
              : Promise.resolve({ data: sale.customers || null }),
            fullSale.seller_id
              ? (supabase as any)
                  .from("profiles")
                  .select("full_name, email")
                  .eq("id", fullSale.seller_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

        const settings = orgSettings || {};
        const orgName = settings.brand_name || org?.name || "Loja";
        let extras: { cnpj?: string; address?: string } = {};
        try {
          if (typeof window !== "undefined" && fullSale.organization_id) {
            extras = JSON.parse(
              localStorage.getItem(`store-details:${fullSale.organization_id}`) || "{}",
            );
          }
        } catch {}
        const cnpj = extras.cnpj ?? settings.cnpj ?? settings.document ?? "";
        const phone = settings.support_whatsapp ?? settings.phone ?? settings.telefone ?? "";
        const address = extras.address ?? settings.address ?? settings.endereco ?? "";
        const logo = settings.brand_logo_url ?? "";
        const sellerName = seller?.full_name || seller?.email || "—";
        const cust = customer || sale.customers || {};

        const titles: Record<string, string> = {
          seminovo: "Termo de Garantia - Seminovo (7 meses)",
          lacrado: "Termo de Garantia - Lacrado (1 ano)",
          android: "Termo de Garantia - Aparelho Android (1 ano)",
        };

        const start = new Date(fullSale.created_at || Date.now());
        const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
        const receiptId = fullSale.sale_number
          ? `MP${String(fullSale.sale_number).padStart(10, "0")}`
          : `#${String(fullSale.id).slice(0, 8).toUpperCase()}`;
        const brl = (n: number) =>
          `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

        const items: any[] = itemsRes.data || [];
        const payments: any[] = paymentsRes.data || [];
        const total = Number(fullSale.total_amount ?? 0);
        const subtotal = Number(fullSale.subtotal ?? total);
        const discount = Number(fullSale.discount ?? 0);

        // Enrich items with product brand/model/category/metadata for the rich description
        const productIds = Array.from(
          new Set(items.map((it: any) => it.product_id).filter(Boolean)),
        );
        let productsById: Record<string, any> = {};
        if (productIds.length) {
          const { data: prods } = await (supabase as any)
            .from("products")
            .select("id, name, brand, model, category, metadata, sku")
            .eq("organization_id", orgId)
            .in("id", productIds);
          for (const p of prods ?? []) productsById[p.id] = p;
        }

        const itemsRows = items.length
          ? items
              .map((it: any) => {
                const p = it.product_id ? productsById[it.product_id] : null;
                const description = buildReceiptItemDescription(it, {
                  brand: it.brand ?? p?.brand ?? null,
                  model: it.model ?? p?.model ?? null,
                  category: p?.category ?? null,
                  metadata: p?.metadata ?? null,
                  sku: it.sku ?? p?.sku ?? null,
                  id: it.product_id,
                  name: it.product_name ?? p?.name,
                });
                return `
            <tr>
              <td>${toProductCode({ id: it.product_id, sku: it.sku })}</td>
              <td>${description}</td>
              <td style="text-align:center;">${it.quantity ?? 1}</td>
              <td style="text-align:right;">${brl(Number(it.unit_price))}</td>
              <td style="text-align:right;">${it.discount ? brl(Number(it.discount)) : "R$"}</td>
              <td style="text-align:right;">${brl(Number(it.total))}</td>
            </tr>`;
              })
              .join("")
          : `<tr><td colspan="6" style="text-align:center;color:#777;">Sem itens</td></tr>`;

        const paymentRows = (
          payments.length
            ? payments
            : [{ method: fullSale.payment_method || "—", amount: total, installments: 1 }]
        )
          .map(
            (p: any) => `
          <tr>
            <td>${METHOD_LABEL[p.method] || p.method}</td>
            <td></td>
            <td style="text-align:right;">${brl(Number(p.amount))}</td>
            <td style="text-align:center;">${p.installments ?? ""}</td>
          </tr>`,
          )
          .join("");

        // Cláusulas EXATAS dos termos de referência (PDF)
        const seminovoClauses = `
<p class="ctitle">DO OBJETO</p>
<p><b>Cláusula 1ª:</b> O comprador está adquirindo o produto descrito acima, em plenas condições de uso, devidamente testado, concordando com todas as características e estado do item, inexistindo qualquer defeito, mediante valor e forma de pagamento ajustado entre as partes.</p>
<p><b>Cláusula 2ª:</b> Por tratar-se de um aparelho seminovo, todas as informações e características do produto foram repassadas pelo vendedor no ato da compra, mas também poderão ser extraídas diretamente no site do fabricante, sendo esse: Manual de Uso do iPhone.</p>
<p><b>Cláusula 3ª:</b> A ${orgName} não garante que o item adquirido nunca foi aberto para reparo ou substituição de peça, estando o comprador ciente de tal condição.</p>

<p class="ctitle">DAS OBRIGAÇÕES DO COMPRADOR</p>
<p><b>Cláusula 4ª:</b> Trata-se de um aparelho seminovo, desta forma, a ${orgName} orienta o comprador a não expor o celular a líquidos ou poeira, tendo em vista que a própria fabricante do aparelho aduz que a resistência contra respingos, água e poeira não é uma condição permanente e pode diminuir com o tempo, gerando assim maior durabilidade do celular.</p>
<p><b>Cláusula 5ª:</b> O consumidor se compromete a utilizar o aparelho celular com proteção adequada, itens originais do fabricante ou homologados, bem como a instalar apenas aplicativos fornecidos no sistema da fabricante (Apple Store).</p>

<p class="ctitle">DAS OBRIGAÇÕES DA VENDEDORA</p>
<p><b>Cláusula 6ª:</b> Na hipótese de o produto apresentar falha ou vício de fabricação dentro do prazo de garantia, o consumidor deverá procurar imediatamente a ${orgName}, não sendo permitido que terceiros avaliem ou reparem o produto, sob pena do comprador ser responsável por tal ato, eximindo a ${orgName} do dever de reparar, além da perda da garantia.</p>
<p><b>Cláusula 7ª:</b> A ${orgName} terá o prazo de 30 dias para reparar o produto em questão, contados a partir do momento em que o produto for recebido pela mesma.</p>
<p><b>Cláusula 8ª:</b> Caso não seja possível efetuar o reparo dentro do prazo de 30 dias e o cliente opte pela troca do produto, deverá ser analisada a disponibilidade do estoque de seminovos, não podendo o consumidor exigir outro aparelho com a mesma cor e saúde da bateria equivalente, tendo em vista tratar-se de um produto seminovo, garantindo a ${orgName} que será entregue um produto em plenas condições de uso, mesmo modelo e capacidade de armazenamento.</p>
<p><b>Cláusula 9ª:</b> Caso seja necessário o reparo e formatação do aparelho celular, é responsabilidade do comprador manter atualizado o backup se assim entender, não sendo a ${orgName} responsável pela perda dos dados, contatos, imagens, vídeos etc.</p>

<p class="ctitle">DA GARANTIA DO PRODUTO</p>
<p><b>Cláusula 10ª:</b> A garantia será de <b>7 meses</b>, contados do recebimento ou retirada em loja do produto, respeitando o Código de Defesa do Consumidor e será prestada pela própria ${orgName} ou terceiros indicados pela mesma.</p>
<p><b>Cláusula 11ª:</b> A garantia do produto cessará nos seguintes casos:</p>
<ul>
  <li>Não sejam seguidas as recomendações de conservação e uso contidas no manual de instrução do próprio fabricante;</li>
  <li>Seja constatado defeito no produto decorrente de negligência, imperícia ou mau uso pelo próprio consumidor;</li>
  <li>O produto seja examinado, adulterado ou consertado por terceiros sem autorização da ${orgName};</li>
  <li>Houver remoção e/ou alteração do número de série do equipamento ou de quaisquer dos seus componentes internos;</li>
  <li>O produto tiver o lacre/selo violado, quando houver;</li>
  <li>Caso ocorra a utilização de hardware, peça ou componente não original ou homologadas;</li>
  <li>Caso ocorra alteração/modificação do software ou sistema operacional original do produto;</li>
  <li>Caso seja constatado danos físicos ou químicos internos ou externos ao produto decorrente de choque, queda, ato e efeito causado por ação de agentes da natureza, líquidos, oxidação, oscilações de tensão elétrica, exposição excessiva ao calor ou pressão excessiva na tela;</li>
  <li>Quando for constatado que o defeito foi causado por equipamento a ele conectado;</li>
  <li>Desgaste natural em razão do envelhecimento do produto;</li>
  <li>Danos estéticos, incluindo arranhões, amassados e rachaduras no produto.</li>
</ul>
<p><b>Cláusula 12ª:</b> Caso a ${orgName} receba o aparelho celular para exercício da garantia e constate uma das ilegalidades supracitadas, o comprador será comunicado imediatamente sobre a não cobertura do reparo de forma gratuita.</p>
<p><b>Cláusula 13ª:</b> Após a constatação e comunicação do comprador, o aparelho ficará disponível para retirada em loja mediante agendamento.</p>

<p class="ctitle">DISPOSIÇÕES GERAIS</p>
<p><b>Cláusula 15ª:</b> Ao assinar o presente contrato, o comprador concorda que a ${orgName} poderá utilizar suas imagens sejam elas mediante vídeo ou fotografia, nas redes sociais da loja, para fins comerciais e de marketing.</p>
<p><b>Cláusula 16ª:</b> A cessão dos direitos de uso e reprodução da imagem do comprador, não gera nenhum ônus lucrativo ao cedente, ocorrendo de forma gratuita e voluntária.</p>
<p><b>Cláusula 17ª:</b> O comprador concorda que a única empresa participante da negociação deste produto é a ${orgName}, registrada no CNPJ informado anteriormente.</p>
<p><b>Cláusula 18ª:</b> A garantia elencada no presente contrato deverá ser exercida exclusivamente pelo comprador qualificado neste ato, o qual deverá apresentar o presente termo ao acionar a garantia.</p>
`;

        const lacradoClauses = `
<p class="ctitle">DO OBJETO</p>
<p><b>Cláusula 1ª:</b> O comprador está adquirindo o produto descrito acima, em plenas condições de uso, devidamente lacrado, testado, concordando com todas as características, inexistindo qualquer defeito, mediante valor e forma de pagamento ajustado entre as partes.</p>
<p><b>Cláusula 2ª:</b> Por tratar-se de um aparelho lacrado, o item acompanha manual impresso pelo fabricante, mas também poderá ser extraído diretamente no site do fabricante, sendo esse: Manual de Uso do iPhone.</p>

<p class="ctitle">DAS OBRIGAÇÕES DO COMPRADOR</p>
<p><b>Cláusula 3ª:</b> A ${orgName} orienta o comprador a não expor o celular a líquidos ou poeira, tendo em vista que a própria fabricante do aparelho aduz que a resistência contra respingos, líquidos e poeira não é uma condição permanente e pode diminuir com o tempo, gerando assim maior durabilidade do celular.</p>
<p><b>Cláusula 4ª:</b> O consumidor se compromete a utilizar o aparelho celular com proteção adequada, itens originais do fabricante ou homologados, bem como a instalar apenas aplicativos fornecidos no sistema da fabricante (Apple Store).</p>

<p class="ctitle">DAS OBRIGAÇÕES DA VENDEDORA</p>
<p><b>Cláusula 5ª:</b> Na hipótese de o produto apresentar falha ou vício de fabricação dentro do prazo de garantia, o consumidor deverá procurar imediatamente a fabricante Apple, não sendo permitido que terceiros avaliem ou reparem o produto, sob pena do comprador ser responsável por tal ato, eximindo a ${orgName} do dever de reparar, além da perda da garantia junto ao fabricante.</p>
<p><b>Cláusula 6ª:</b> A ${orgName} prestará total auxílio ao comprador, informando todo o procedimento necessário para exercer sua garantia junto ao fabricante.</p>
<p><b>Cláusula 7ª:</b> Caso seja necessário o reparo e formatação do aparelho celular, é responsabilidade do comprador manter atualizado o backup se assim entender, não sendo a ${orgName} responsável pela perda dos dados, contatos, imagens, vídeos etc.</p>

<p class="ctitle">DA GARANTIA DO PRODUTO</p>
<p><b>Cláusula 8ª:</b> A garantia do produto terá validade por <b>12 meses</b>, contados do recebimento ou retirada em loja, garantia essa fornecida pelo próprio fabricante e que deverá ser acionada seguindo os procedimentos internos da Apple.</p>
<p><b>Cláusula 9ª:</b> A garantia do produto cessará nos seguintes casos:</p>
<ul>
  <li>Não sejam seguidas as recomendações de conservação e uso contidas no manual de instrução do próprio fabricante;</li>
  <li>Seja constatado defeito no produto decorrente de negligência, imperícia ou mau uso pelo próprio consumidor;</li>
  <li>O produto seja examinado, adulterado ou consertado por terceiros sem autorização da ${orgName};</li>
  <li>Houver remoção e/ou alteração do número de série do equipamento ou de quaisquer dos seus componentes internos;</li>
  <li>O produto tiver o lacre/selo violado, quando houver;</li>
  <li>Caso ocorra a utilização de hardware, peça ou componente não original ou homologadas;</li>
  <li>Caso ocorra alteração/modificação do software ou sistema operacional original do produto;</li>
  <li>Caso seja constatado danos físicos ou químicos internos ou externos ao produto decorrente de choque, queda, ato e efeito causado por ação de agentes da natureza, líquidos, oxidação, oscilações de tensão elétrica, exposição excessiva ao calor ou pressão excessiva na tela;</li>
  <li>Quando for constatado que o defeito foi causado por equipamento a ele conectado;</li>
  <li>Desgaste natural em razão do envelhecimento do produto;</li>
  <li>Danos estéticos, incluindo arranhões, amassados e rachaduras no produto.</li>
</ul>
<p><b>Cláusula 10ª:</b> Caso a ${orgName} ou a fabricante receba o aparelho celular para exercício da garantia e constate uma das ilegalidades supracitadas, o comprador será comunicado imediatamente sobre a não cobertura do reparo de forma gratuita.</p>
<p><b>Cláusula 11ª:</b> Após a constatação e comunicação do comprador, o aparelho ficará disponível para retirada em loja mediante agendamento.</p>

<p class="ctitle">DISPOSIÇÕES GERAIS</p>
<p><b>Cláusula 13ª:</b> Ao assinar o presente contrato, o comprador concorda que a ${orgName} poderá utilizar suas imagens sejam elas mediante vídeo ou fotografia, nas redes sociais da loja, para fins comerciais e de marketing.</p>
<p><b>Cláusula 14ª:</b> A cessão dos direitos de uso e reprodução da imagem do comprador, não gera nenhum ônus lucrativo ao cedente, ocorrendo de forma gratuita e voluntária.</p>
<p><b>Cláusula 15ª:</b> O comprador concorda que a única empresa participante da negociação deste produto é a ${orgName}, registrada no CNPJ informado anteriormente.</p>
<p><b>Cláusula 16ª:</b> A garantia elencada no presente contrato deverá ser exercida exclusivamente pelo comprador qualificado neste ato junto ao fabricante.</p>
`;

        const clauses = type === "seminovo" ? seminovoClauses : lacradoClauses;

        const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titles[type]}</title>
<style>
*{box-sizing:border-box;}
body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;padding:18px;max-width:900px;margin:0 auto;line-height:1.45;font-size:12px;}
table{width:100%;border-collapse:collapse;font-size:12px;}
th,td{border:1px solid #000;padding:5px 7px;text-align:left;vertical-align:top;}
th{background:#fafafa;text-align:center;font-weight:bold;}
.head-title{border:1px solid #000;border-bottom:none;padding:6px 8px;font-weight:bold;font-size:12.5px;text-transform:uppercase;}
.recipient td{height:48px;}
.store-info{text-align:center;}
.store-info img{max-height:60px;display:block;margin:0 auto 4px;}
.section-label{font-weight:bold;font-size:12px;margin:10px 2px 4px;}
.text-right{text-align:right;}
.text-center{text-align:center;}
.clauses{margin-top:16px;}
.clauses p{margin:6px 0;text-align:justify;}
.clauses ul{margin:6px 0 6px 18px;padding:0;}
.clauses li{margin:3px 0;text-align:justify;}
.ctitle{font-weight:bold;text-transform:uppercase;margin-top:14px !important;text-align:center;letter-spacing:.4px;}
.sign{margin-top:48px;display:flex;justify-content:space-between;gap:40px;}
.sign div{flex:1;text-align:center;border-top:1px solid #000;padding-top:4px;font-size:11px;}
.thanks{text-align:center;font-weight:bold;margin:18px 0 6px;font-size:12px;}
@media print{body{padding:10mm;}@page{size:A4;margin:10mm;}}
</style></head><body>

<div class="head-title">RECIBO DE ${orgName.toUpperCase()} OS PRODUTOS E/OU SERVIÇOS CONSTANTES NO PEDIDO</div>
<table>
  <tr>
    <td style="width:30%;">Data de recebimento</td>
    <td>Identificação e assinatura do recebedor</td>
    <td style="width:30%;">Recibo da venda: <b>${receiptId}</b></td>
  </tr>
  <tr class="recipient"><td></td><td></td><td></td></tr>
</table>

<table>
  <tr>
    <td class="store-info" style="width:22%;">
      ${logo ? `<img src="${logo}" alt="${orgName}"/>` : `<b>${orgName}</b>`}
    </td>
    <td class="store-info">
      <b>${orgName}</b><br/>
      ${cnpj ? `CNPJ: ${cnpj}<br/>` : ""}
      ${phone ? `Telefone: ${phone}<br/>` : ""}
      ${address ? `<span style="font-size:11px;">${address}</span>` : ""}
    </td>
    <td style="width:28%;">
      <b>${fmt(start)}</b><br/>
      <b>VENDEDOR:</b> ${sellerName}<br/>
      <b>RECIBO DA VENDA:</b> ${receiptId}
    </td>
  </tr>
</table>

<div class="section-label">DESTINATÁRIO/REMETENTE</div>
<table>
  <tr>
    <th>Nome/Razão social</th>
    <th style="width:18%;">Telefone</th>
    <th style="width:18%;">CPF/CNPJ</th>
    <th style="width:22%;">E-mail</th>
  </tr>
  <tr>
    <td>${cust?.name || ""}</td>
    <td>${cust?.phone || ""}</td>
    <td>${cust?.document || cust?.cpf || cust?.cnpj || ""}</td>
    <td>${cust?.email || ""}</td>
  </tr>
  <tr>
    <th>Endereço</th><th>CEP</th><th>Cidade</th><th>Estado</th>
  </tr>
  <tr>
    <td>${cust?.address || cust?.endereco || ""}</td>
    <td>${cust?.zip || cust?.cep || ""}</td>
    <td>${cust?.city || cust?.cidade || ""}</td>
    <td>${cust?.state || cust?.uf || ""}</td>
  </tr>
</table>

<div class="section-label">DADOS DO PRODUTO</div>
<table>
  <tr>
    <th style="width:9%;">Cód</th>
    <th>Produto</th>
    <th style="width:6%;">Qtd</th>
    <th style="width:13%;">Valor Unitário</th>
    <th style="width:11%;">Desconto</th>
    <th style="width:13%;">Valor Total</th>
  </tr>
  ${itemsRows}
  <tr>
    <td colspan="3" class="text-right"><b>Total</b></td>
    <td class="text-right"><b>${brl(subtotal)}</b></td>
    <td class="text-right"><b>${discount ? brl(discount) : "R$"}</b></td>
    <td class="text-right"><b>${brl(total)}</b></td>
  </tr>
</table>

<div class="section-label">PAGAMENTO</div>
<table>
  <tr>
    <th style="width:25%;">Forma de Pagamento</th>
    <th>Detalhes</th>
    <th style="width:20%;">Valor Pago</th>
    <th style="width:12%;">Parcelas</th>
  </tr>
  ${paymentRows}
  <tr>
    <td colspan="2" class="text-right"><b>Total</b></td>
    <td class="text-right"><b>${brl(total)}</b></td>
    <td></td>
  </tr>
</table>

<div class="section-label">OBSERVAÇÃO</div>
<div style="border:1px solid #000;min-height:30px;padding:6px;"></div>

<div class="section-label">DADOS ADICIONAIS</div>
<div class="clauses">${clauses}</div>

<div class="sign">
  <div>${cust?.name || ""}</div>
  <div>${orgName}</div>
</div>

<div class="thanks">OBRIGADO PELA PREFERÊNCIA.</div>

<script>window.onload=function(){};</script>
</body></html>`;

        setWarrantyDoc({ title: titles[type], html });
      } catch (e) {
        console.error("Erro ao gerar termo de garantia:", e);
        toast.error("Não foi possível gerar o termo de garantia.");
      } finally {
        setWarrantyLoading(false);
      }
    },
    [orgId],
  );

  const openWarrantyDialog = useCallback(
    async (sale: any, type: "seminovo" | "lacrado" | "android") => {
      setIsDetailsOpen(false);
      setSelectedSale(null);
      setWarrantyDoc(null);
      setWarrantyLoading(true);
      await openWarrantyPrint(sale, type);
    },
    [openWarrantyPrint],
  );

  const printWarranty = useCallback(() => {
    const iframe = warrantyIframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (e) {
      console.error(e);
      toast.error("Falha ao acionar impressão.");
    }
  }, []);


  const openReceiptPopup = useCallback(
    async (sale: any, mode: "a4" | "80mm" = "a4", autoPrint = false) => {
      if (!orgId) return;
      setIsDetailsOpen(false);
      setSelectedSale(null);
      setReceiptMode(mode);
      setIsReceiptOpen(true);
      setReceiptLoading(true);
      setReceiptError(null);
      setReceiptData(null);

      try {
        const [saleRes, itemsRes, paymentsRes] = await Promise.all([
          (supabase as any).from("sales_orders").select("*").eq("id", sale.id).eq("organization_id", orgId).maybeSingle(),
          (supabase as any).from("sale_items").select("*").eq("sale_id", sale.id).eq("organization_id", orgId),
          (supabase as any).from("sale_payments").select("*").eq("sale_id", sale.id).eq("organization_id", orgId),
        ]);

        if (saleRes.error) throw saleRes.error;
        const fullSale = saleRes.data || sale;
        if (!fullSale) throw new Error("Venda não encontrada");

        const [{ data: org }, { data: orgSettings }, { data: customer }, { data: seller }] =
          await Promise.all([
            fullSale.organization_id
              ? (supabase as any)
                  .from("organizations")
                  .select("name")
                  .eq("id", fullSale.organization_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            fullSale.organization_id
              ? (supabase as any)
                  .from("organization_settings")
                  .select("*")
                  .eq("organization_id", fullSale.organization_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
            fullSale.customer_id
              ? (supabase as any)
                  .from("customers")
                  .select("*")
                  .eq("id", fullSale.customer_id)
                  .eq("organization_id", orgId)
                  .maybeSingle()
              : Promise.resolve({ data: sale.customers || null }),
            fullSale.seller_id
              ? (supabase as any)
                  .from("profiles")
                  .select("full_name, email")
                  .eq("id", fullSale.seller_id)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ]);

        // Enrich items with product details (brand/model/category/metadata)
        const items = itemsRes.data || [];
        const productIds = Array.from(
          new Set(items.map((it: any) => it.product_id).filter(Boolean)),
        );
        let productsById: Record<string, any> = {};
        if (productIds.length) {
          const { data: prods } = await (supabase as any)
            .from("products")
            .select("id, name, brand, model, category, metadata, sku")
            .eq("organization_id", orgId)
            .in("id", productIds);
          for (const p of prods ?? []) productsById[p.id] = p;
        }
        const enrichedItems = items.map((it: any) => {
          const p = it.product_id ? productsById[it.product_id] : null;
          return {
            ...it,
            brand: it.brand ?? p?.brand ?? null,
            model: it.model ?? p?.model ?? null,
            category: p?.category ?? null,
            metadata: p?.metadata ?? null,
          };
        });

        const settings = orgSettings || {};
        // Local-only store extras (CNPJ/address persisted from the store dialog)
        let extras: { cnpj?: string; address?: string } = {};
        try {
          if (typeof window !== "undefined" && fullSale.organization_id) {
            extras = JSON.parse(
              localStorage.getItem(`store-details:${fullSale.organization_id}`) || "{}",
            );
          }
        } catch {}

        setReceiptData({
          sale: fullSale,
          items: enrichedItems,
          payments: paymentsRes.data || [],
          org_name: settings.brand_name || org?.name || "Loja",
          org: {
            address: extras.address ?? settings.address ?? settings.endereco ?? null,
            cnpj: extras.cnpj ?? settings.cnpj ?? settings.document ?? null,
            phone: settings.support_whatsapp ?? settings.phone ?? settings.telefone ?? null,
            website: settings.website ?? null,
            logo_url: settings.brand_logo_url ?? null,
          },
          seller: seller ? { name: seller.full_name || seller.email } : null,
          customer: customer || sale.customers || null,
        });

        if (autoPrint) setPendingReceiptPrint(mode);
      } catch (error) {
        console.error("Erro ao carregar recibo:", error);
        setReceiptError("Não foi possível carregar o recibo desta venda.");
      } finally {
        setReceiptLoading(false);
      }
    },
    [orgId],
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Resumo de Vendas - Novo Design */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <ShoppingBag className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Vendas Hoje
                </p>
                <div className="text-2xl font-bold mt-0.5">
                  {stats.todayTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-success font-bold">
                  <TrendingUp className="h-3 w-3" />
                  <span>{stats.todayCount} vendas</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center text-success">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ticket Médio
                </p>
                <div className="text-2xl font-bold mt-0.5">
                  {stats.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground font-bold">
                  <Clock className="h-3 w-3" />
                  <span>Últimos 30 dias</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Canceladas
                </p>
                <div className="text-2xl font-bold mt-0.5 text-destructive">
                  {stats.canceledCount}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-destructive font-bold">
                  <TrendingDown className="h-3 w-3" />
                  <span>Reflete perdas</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-info/10 flex items-center justify-center text-info">
                <ArrowUpRight className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Acumulado
                </p>
                <div className="text-2xl font-bold mt-0.5">
                  {stats.totalRevenue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-info font-bold">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{stats.totalCount} registros</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/50 p-4 rounded-2xl border border-border/50">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 md:max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              placeholder="Buscar por ID, cliente ou forma de pagamento..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-background border border-border/60 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-border/60 bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            <option value="all">Todo período</option>
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="month">Este mês</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-11 px-4 rounded-xl border border-border/60 bg-background text-sm font-medium"
          >
            <option value="all">Todos status</option>
            <option value="completed">Concluída</option>
            <option value="pending">Pendente</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              import("@/lib/exportCsv").then(({ exportToCsv }) => {
                exportToCsv(
                  "vendas-historico.csv",
                  filteredSales.map((s) => ({
                    data: s.created_at,
                    cliente: s.customer_name ?? s.customer?.name,
                    total: s.total_amount,
                    pagamento: s.payment_method,
                    status: s.status,
                  })),
                );
              });
            }}
            className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Exportar Relatório
          </button>
        </div>
      </div>

      <div className="bg-card border border-border/40 rounded-2xl overflow-hidden shadow-xl shadow-black/5">
        <div className="p-5 border-b border-border/40 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg tracking-tight">Listagem de Vendas</h2>
            <Badge variant="outline" className="rounded-md bg-background/50">
              {filteredSales.length} registros
            </Badge>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/40 bg-muted/10">
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  ID Venda
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Cliente
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Data & Hora
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Forma Pagto
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Valor Total
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                    <p className="text-sm font-medium text-muted-foreground mt-4">
                      Sincronizando banco de dados...
                    </p>
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="bg-muted/30 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-base font-semibold text-muted-foreground">
                      Nenhuma venda encontrada
                    </p>
                    <p className="text-sm text-muted-foreground/60">
                      Tente ajustar seus termos de busca.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-primary/[0.02] transition-colors group cursor-pointer"
                    onClick={() => {
                      void openSaleDetails(sale);
                    }}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center">
                          <ShoppingBag className="h-4 w-4 text-primary/70" />
                        </div>
                        <span className="font-mono text-xs font-bold text-primary tracking-tight">
                          #{sale.id.slice(0, 6).toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          <User className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-bold tracking-tight">
                          {sale.customers?.name || "Consumidor Final"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {format(new Date(sale.created_at), "dd 'de' MMM", { locale: ptBR })}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                          {format(new Date(sale.created_at), "HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <Badge
                        variant="secondary"
                        className="bg-muted/50 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
                      >
                        {sale.payment_method || "N/A"}
                      </Badge>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-black text-foreground">
                        {(sale.total_amount || 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      {(() => {
                        const isDone = ["concluded", "completed", "paid"].includes(sale.status);
                        const isPending = ["pending", "open"].includes(sale.status);
                        const tone = isDone
                          ? "bg-success/5 text-success border-success/20"
                          : isPending
                            ? "bg-warning/5 text-warning border-warning/20"
                            : "bg-destructive/5 text-destructive border-destructive/20";
                        const dot = isDone ? "bg-success" : isPending ? "bg-warning" : "bg-destructive";
                        const label = isDone ? "CONCLUÍDA" : isPending ? "PENDENTE" : "CANCELADA";
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border transition-all ${tone}`}>
                            <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${dot}`} />
                            {label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 rounded-xl hover:bg-primary/10 transition-colors border border-border/40 flex items-center gap-2"
                          >
                            <span className="font-bold text-[10px] uppercase tracking-widest text-primary">
                              Ação
                            </span>
                            <MoreHorizontal className="h-4 w-4 text-primary" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-56 p-1.5 rounded-xl shadow-2xl border-border/40 bg-card/95 backdrop-blur-md"
                        >
                          {[
                            {
                              icon: Edit,
                              label: "Editar",
                              onClick: () => {
                                if (sale.status === "cancelled" || sale.status === "canceled") {
                                  toast.error("Vendas canceladas não podem ser editadas.");
                                  return;
                                }
                                window.open(`/pdv?edit=${sale.id}`, "_blank");
                              },
                            },
                            {
                              icon: Package,
                              label: "Detalhes do produto",
                              onClick: () => {
                                void openSaleDetails(sale);
                              },
                            },
                            {
                              icon: FileText,
                              label: "Recibo",
                              onClick: () => openReceiptPopup(sale),
                            },
                            {
                              icon: Printer,
                              label: "Recibo 80mm",
                              onClick: () => openReceiptPopup(sale, "80mm", true),
                            },
                            {
                              icon: ShieldCheck,
                              iconClass: "text-blue-600",
                              label: "Garantia - Lacrado (1 ano)",
                              onClick: () => openWarrantyDialog(sale, "lacrado"),
                            },
                            {
                              icon: ShieldCheck,
                              iconClass: "text-amber-600",
                              label: "Garantia - Seminovo (7 meses)",
                              onClick: () => openWarrantyDialog(sale, "seminovo"),
                            },
                            {
                              icon: MessageSquare,
                              iconClass: "text-green-600",
                              label: "Whatsapp",
                              onClick: () => {
                                const phone = sale.customers?.phone?.replace(/\D/g, "");
                                if (!phone) return toast.error("Cliente sem telefone.");
                                window.open(
                                  `https://wa.me/55${phone}?text=Olá! Segue o link do seu comprovante: ${window.location.origin}/recibo/${sale.id}`,
                                  "_blank",
                                );
                              },
                            },
                            {
                              icon: Repeat2,
                              label: "Devolução/Troca",
                              onClick: () => toast.info("Abrindo fluxo de devolução/troca..."),
                            },
                            {
                              icon: XCircle,
                              iconClass: "text-destructive",
                              danger: true,
                              label: "Cancelar a venda",
                              onClick: async () => {
                                if (!confirm("Deseja realmente cancelar esta venda?")) return;
                                try {
                                  const { error } = await supabase
                                    .from("sales_orders")
                                    .update({ status: "canceled" })
                                    .eq("id", sale.id)
                                    .eq("organization_id", orgId);
                                  if (error) throw error;
                                  toast.success("Venda cancelada!");
                                  fetchSales();
                                } catch {
                                  toast.error("Erro ao cancelar venda.");
                                }
                              },
                            },
                            {
                              icon: Folder,
                              label: "Arquivos",
                              onClick: () => toast.info("Abrindo arquivos da venda..."),
                            },
                            {
                              icon: Truck,
                              label: "Imprimir Delivery",
                              onClick: () => openReceiptPopup(sale, "a4", true),
                            },
                            {
                              icon: PenLine,
                              label: "Assinar",
                              onClick: () => toast.info("Captura de assinatura em breve."),
                            },
                            {
                              icon: Mail,
                              label: "Enviar por E-mail",
                              onClick: () => {
                                const email = (sale.customers as any)?.email;
                                if (!email) return toast.error("Cliente sem e-mail cadastrado.");
                                window.location.href = `mailto:${email}?subject=Recibo da venda&body=${encodeURIComponent(
                                  `Segue o link do recibo: ${window.location.origin}/recibo/${sale.id}`,
                                )}`;
                              },
                            },
                            {
                              icon: CreditCard,
                              label: "Pagamento TEF",
                              onClick: () => toast.info("Conectando ao TEF..."),
                            },
                          ].map((opt, i) => {
                            const Icon = opt.icon;
                            return (
                              <DropdownMenuItem
                                key={i}
                                onClick={opt.onClick}
                                className={`gap-3 py-2 px-2.5 rounded-lg cursor-pointer text-[13px] font-medium ${
                                  opt.danger
                                    ? "text-destructive focus:text-destructive focus:bg-destructive/10"
                                    : "focus:bg-primary/10"
                                }`}
                              >
                                <Icon
                                  className={`h-4 w-4 ${opt.iconClass ?? "text-foreground/70"}`}
                                />
                                <span>{opt.label}</span>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes da Venda */}
      <Dialog
        open={isDetailsOpen && !isReceiptOpen && !!selectedSale}
        onOpenChange={setIsDetailsOpen}
      >
        <DialogContent className="sm:max-w-[560px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card">
          {selectedSale &&
            (() => {
              const rawStatus = selectedSale.status as string;
              const status = ["completed", "concluded", "paid"].includes(rawStatus)
                ? "concluded"
                : ["pending", "open"].includes(rawStatus)
                  ? "pending"
                  : "cancelled";
              const statusMap: Record<string, { label: string; cls: string; dot: string }> = {
                concluded: {
                  label: "CONCLUÍDA",
                  cls: "bg-success/10 text-success border-success/30",
                  dot: "bg-success",
                },
                pending: {
                  label: "PENDENTE",
                  cls: "bg-warning/10 text-warning border-warning/30",
                  dot: "bg-warning",
                },
                cancelled: {
                  label: "CANCELADA",
                  cls: "bg-destructive/10 text-destructive border-destructive/30",
                  dot: "bg-destructive",
                },
              };
              const st = statusMap[status] || statusMap.cancelled;
              const total = Number(selectedSale.total_amount || 0);
              const subtotal = Number(selectedSale.subtotal ?? total);
              const discount = Number(selectedSale.discount || 0);
              const addition = Number(selectedSale.addition || 0);
              const saleCode = selectedSale.sale_number
                ? `#${String(selectedSale.sale_number).padStart(6, "0")}`
                : `#${selectedSale.id.slice(0, 8).toUpperCase()}`;
              const brl = (n: number) =>
                n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
              const isCancelled = status === "cancelled";

              return (
                <div className="flex flex-col">
                  {/* Hero header com gradiente azul */}
                  <div className="relative p-6 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground overflow-hidden">
                    <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
                    <div className="absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-white/5 blur-2xl pointer-events-none" />
                    <div className="relative flex items-start justify-between mb-4">
                      <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                      <Badge
                        className={`${st.cls} backdrop-blur font-black tracking-wider px-3 py-1 rounded-full`}
                      >
                        <span
                          className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot} animate-pulse inline-block`}
                        />
                        {st.label}
                      </Badge>
                    </div>
                    <DialogHeader className="text-left relative">
                      <DialogTitle className="text-2xl font-black tracking-tight">
                        Venda {saleCode}
                      </DialogTitle>
                      <DialogDescription className="text-sm font-medium text-primary-foreground/80 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(selectedSale.created_at), "dd 'de' MMMM 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </DialogDescription>
                    </DialogHeader>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Cliente */}
                    <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                      <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-base">
                        {(selectedSale.customers?.name || "C")
                          .split(" ")
                          .map((p: string) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                          Cliente
                        </div>
                        <div className="font-bold text-base truncate">
                          {selectedSale.customers?.name || "Consumidor Final"}
                        </div>
                      </div>
                      {selectedSale.channel && (
                        <Badge variant="outline" className="rounded-full font-bold capitalize">
                          {selectedSale.channel}
                        </Badge>
                      )}
                    </div>

                    {/* Produtos vendidos */}
                    <div className="rounded-2xl border border-border/60 bg-muted/30 overflow-hidden">
                      <div className="px-3.5 py-2.5 flex items-center justify-between border-b border-border/60 bg-background/50">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                            Produtos vendidos
                          </span>
                        </div>
                        <Badge variant="outline" className="rounded-full text-[10px] font-bold">
                          {detailsItemsLoading ? "…" : `${detailsItems.length} item(ns)`}
                        </Badge>
                      </div>
                      {detailsItemsLoading ? (
                        <div className="p-4 flex items-center justify-center text-xs text-muted-foreground gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando produtos…
                        </div>
                      ) : detailsItems.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          Nenhum produto registrado nesta venda.
                        </div>
                      ) : (
                        <ul className="divide-y divide-border/60">
                          {detailsItems.map((it: any) => {
                            const qty = Number(it.quantity || 0);
                            const unit = Number(it.unit_price || 0);
                            const lineTotal = Number(it.total ?? unit * qty);
                            return (
                              <li
                                key={it.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  void openProductDetail(it);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    void openProductDetail(it);
                                  }
                                }}
                                className="p-3 flex items-start gap-3 cursor-pointer hover:bg-primary/[0.04] transition-colors focus:outline-none focus:bg-primary/[0.06]"
                              >
                                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Package className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm truncate">
                                      {it.product_name || "Produto"}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="rounded-full text-[10px] font-mono"
                                    >
                                      <Hash className="h-3 w-3 mr-0.5" />
                                      {toProductCode({ id: it.product_id, sku: it.sku })}
                                    </Badge>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                                    <span>
                                      <span className="font-bold text-foreground">{qty}x</span>{" "}
                                      {brl(unit)}
                                    </span>
                                    {it.imei && (
                                      <span className="font-mono">IMEI: {it.imei}</span>
                                    )}
                                    {it.model && <span>{it.model}</span>}
                                    {Number(it.discount || 0) > 0 && (
                                      <span className="text-success">
                                        - {brl(Number(it.discount))}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-black">
                                    Total
                                  </div>
                                  <div className="font-black text-sm text-primary">
                                    {brl(lineTotal)}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>


                    {/* Pagamento + Itens */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                          Pagamento
                        </div>
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-primary" />
                          <span className="font-bold text-sm capitalize truncate">
                            {selectedSale.payment_method || "Não informado"}
                          </span>
                        </div>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                          Identificação
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedSale.id);
                            toast.success("ID copiado!");
                          }}
                          className="flex items-center gap-2 font-mono text-xs font-bold hover:text-primary transition"
                          title="Copiar ID"
                        >
                          <Info className="h-4 w-4 text-primary" />
                          {selectedSale.id.slice(0, 8).toUpperCase()}
                        </button>
                      </div>
                    </div>

                    {/* Resumo financeiro */}
                    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-bold">{brl(subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <ArrowDownRight className="h-3.5 w-3.5 text-success" /> Desconto
                          </span>
                          <span className="font-bold text-success">- {brl(discount)}</span>
                        </div>
                      )}
                      {addition > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <ArrowUpRight className="h-3.5 w-3.5 text-warning" /> Acréscimo
                          </span>
                          <span className="font-bold text-warning">+ {brl(addition)}</span>
                        </div>
                      )}
                      <div className="border-t border-border/50 pt-2 mt-2 flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                          Total da Venda
                        </span>
                        <span className="text-2xl font-black text-primary">{brl(total)}</span>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 text-[11px] disabled:opacity-50"
                        disabled={isCancelled}
                        onClick={() => {
                          if (isCancelled) {
                            toast.error("Vendas canceladas não podem ser editadas.");
                            return;
                          }
                          window.open(`/pdv?edit=${selectedSale.id}`, "_blank");
                          setIsDetailsOpen(false);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        className="h-11 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 text-[11px]"
                        onClick={() => {
                          setIsDetailsOpen(false);
                          openReceiptPopup(selectedSale);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        Recibo
                      </Button>
                      <Button
                        variant="outline"
                        className="h-11 rounded-xl font-bold flex flex-col items-center justify-center gap-0.5 text-[11px]"
                        onClick={() => {
                          toast.info("Preparando cupom...");
                          openReceiptPopup(selectedSale, "a4", true);
                        }}
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </Button>
                    </div>

                    {/* Compartilhar */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-lg font-semibold text-xs gap-1.5"
                        onClick={() => {
                          const url = `${window.location.origin}/recibo/${selectedSale.id}`;
                          const msg = `Olá! Segue o recibo da sua compra ${saleCode}: ${url}`;
                          const phone =
                            (selectedSale.customers as any)?.phone?.replace(/\D/g, "") || "";
                          window.open(
                            `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
                            "_blank",
                          );
                        }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-lg font-semibold text-xs gap-1.5"
                        onClick={() => {
                          const url = `${window.location.origin}/recibo/${selectedSale.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Link do recibo copiado!");
                        }}
                      >
                        <Share2 className="h-3.5 w-3.5" /> Copiar link
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {/* Modal — Detalhes do Produto vendido */}
      <Dialog open={!!productDetail} onOpenChange={(o) => !o && setProductDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden p-0 rounded-2xl bg-card border-border/60">
          {(() => {
            if (!productDetail) return null;
            const brl = (n: number) =>
              new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                Number.isFinite(n) ? n : 0,
              );
            const it = productDetail.item || {};
            const p = productDetail.product || {};
            const meta = (p.metadata && typeof p.metadata === "object") ? p.metadata : {};
            // Excluir custo e fornecedor
            const HIDE = new Set([
              "cost", "cost_price", "purchase_price", "custo", "preco_custo",
              "supplier", "supplier_id", "supplier_name", "fornecedor",
            ]);
            const pickFirst = (...keys: string[]) => {
              for (const k of keys) {
                const v = (it as any)[k] ?? (p as any)[k] ?? (meta as any)[k];
                if (v !== undefined && v !== null && String(v).trim() !== "") return v;
              }
              return null;
            };
            const brand = pickFirst("brand", "marca", "manufacturer");
            const model = pickFirst("model", "modelo");
            const storage = pickFirst("storage", "gigas", "capacity", "gb");
            const color = pickFirst("color", "cor");
            const imei = pickFirst("imei", "imei1", "imei_1");
            const imei2 = pickFirst("imei2", "imei_2");
            const serial = pickFirst("serial", "serial_number", "sn");
            const condition = pickFirst("condition", "estado", "status_produto");
            const battery = pickFirst("battery_health", "bateria", "battery");
            const warranty = pickFirst("warranty", "garantia");
            const category = pickFirst("category", "categoria");
            const description = pickFirst("description", "descricao", "notes");
            const qty = Number(it.quantity || 0);
            const unit = Number(it.unit_price || 0);
            const lineTotal = Number(it.total ?? unit * qty);
            const productName = it.product_name || p.name || "Produto";

            // Coletar campos extras do metadata, exceto os escondidos / já exibidos
            const shown = new Set([
              "brand","marca","manufacturer","model","modelo","storage","gigas","capacity","gb",
              "color","cor","imei","imei1","imei_1","imei2","imei_2","serial","serial_number","sn",
              "condition","estado","status_produto","battery_health","bateria","battery",
              "warranty","garantia","category","categoria","description","descricao","notes",
            ]);
            const extras = Object.entries(meta).filter(
              ([k, v]) =>
                !HIDE.has(k) &&
                !shown.has(k) &&
                v !== null &&
                v !== "" &&
                typeof v !== "object",
            );

            const Row = ({ label, value }: { label: string; value: any }) =>
              value === null || value === undefined || value === "" ? null : (
                <div className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                  <span className="text-[11px] uppercase tracking-widest font-black text-muted-foreground/70">
                    {label}
                  </span>
                  <span className="text-sm font-semibold text-foreground text-right break-all">
                    {String(value)}
                  </span>
                </div>
              );

            return (
              <>
                <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-primary-foreground">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-widest font-black opacity-80">
                        Detalhes do produto
                      </div>
                      <DialogTitle className="text-xl font-black truncate">
                        {productName}
                      </DialogTitle>
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] opacity-90">
                        <Badge variant="secondary" className="rounded-full font-mono text-[10px] bg-white/15 text-white border-0">
                          <Hash className="h-3 w-3 mr-0.5" />
                          {toProductCode({ id: it.product_id, sku: it.sku ?? p.sku })}
                        </Badge>
                        {category && <span>{String(category)}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
                  {productDetailLoading && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando informações…
                    </div>
                  )}

                  <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-2">
                    <Row label="Marca" value={brand} />
                    <Row label="Modelo" value={model} />
                    <Row label="Capacidade" value={storage ? `${storage}${String(storage).match(/gb|tb/i) ? "" : " GB"}` : null} />
                    <Row label="Cor" value={color} />
                    <Row label="Condição" value={condition} />
                    <Row label="Saúde da bateria" value={battery ? `${battery}${String(battery).includes("%") ? "" : "%"}` : null} />
                    <Row label="IMEI" value={imei} />
                    <Row label="IMEI 2" value={imei2} />
                    <Row label="Serial" value={serial} />
                    <Row label="Garantia" value={warranty} />
                    {extras.map(([k, v]) => (
                      <Row key={k} label={k.replace(/_/g, " ")} value={v} />
                    ))}
                  </div>

                  {description && (
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/70 mb-1.5">
                        Descrição
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{String(description)}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-muted/40 border border-border/60 p-3 text-center">
                      <div className="text-[10px] uppercase font-black text-muted-foreground/70">Qtd</div>
                      <div className="text-lg font-black text-foreground">{qty}</div>
                    </div>
                    <div className="rounded-xl bg-muted/40 border border-border/60 p-3 text-center">
                      <div className="text-[10px] uppercase font-black text-muted-foreground/70">Unitário</div>
                      <div className="text-lg font-black text-foreground">{brl(unit)}</div>
                    </div>
                    <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 text-center">
                      <div className="text-[10px] uppercase font-black text-primary/80">Total</div>
                      <div className="text-lg font-black text-primary">{brl(lineTotal)}</div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>



      {/* Modal do Recibo */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent
          className={`${receiptMode === "80mm" ? "max-w-[420px]" : "max-w-[940px]"} max-h-[92vh] overflow-hidden p-0 rounded-2xl bg-card border-border/60`}
        >
          <div className="print:hidden flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60 bg-muted/30">
            <div>
              <DialogTitle className="text-lg font-black tracking-tight">
                {receiptMode === "80mm" ? "Cupom 80mm" : "Recibo da venda"}
              </DialogTitle>
              <DialogDescription>Confira o recibo antes de imprimir.</DialogDescription>
            </div>
            <Button
              disabled={!receiptData || receiptLoading}
              onClick={() => void printReceiptArea(receiptMode)}
              className="rounded-xl font-bold gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
          <div className="max-h-[calc(92vh-73px)] overflow-auto bg-muted/40 p-4 print:max-h-none print:overflow-visible print:bg-white print:p-0">
            {receiptLoading ? (
              <div className="h-[420px] flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-bold text-muted-foreground">Carregando recibo...</p>
              </div>
            ) : receiptError ? (
              <div className="h-[420px] flex flex-col items-center justify-center gap-3 text-center">
                <AlertCircle className="h-10 w-10 text-destructive" />
                <p className="font-bold">{receiptError}</p>
                <Button variant="outline" onClick={() => setIsReceiptOpen(false)}>
                  Fechar
                </Button>
              </div>
            ) : receiptData ? (
              receiptMode === "80mm" ? (
                <Receipt80mm data={receiptData} />
              ) : (
                <ReceiptPreview data={receiptData} />
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal do Termo de Garantia */}
      <Dialog
        open={!!warrantyDoc || warrantyLoading}
        onOpenChange={(open) => {
          if (!open) {
            setWarrantyDoc(null);
            setWarrantyLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-[960px] max-h-[92vh] overflow-hidden p-0 rounded-2xl bg-card border-border/60">
          <div className="print:hidden flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60 bg-muted/30">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-black tracking-tight truncate">
                {warrantyDoc?.title || "Termo de Garantia"}
              </DialogTitle>
              <DialogDescription>Revise o termo antes de imprimir.</DialogDescription>
            </div>
            <Button
              disabled={!warrantyDoc || warrantyLoading}
              onClick={printWarranty}
              className="rounded-xl font-bold gap-2"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
          <div className="bg-muted/40 p-4 h-[calc(92vh-73px)]">
            {warrantyLoading || !warrantyDoc ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-bold text-muted-foreground">Gerando termo...</p>
              </div>
            ) : (
              <iframe
                ref={warrantyIframeRef}
                title={warrantyDoc.title}
                srcDoc={warrantyDoc.html}
                className="w-full h-full bg-white rounded-xl border border-border/60 shadow-sm"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReceiptPreview({ data }: { data: ReceiptData }) {
  const sale = data.sale || {};
  const customer = data.customer || {};
  const total = Number(sale.total_amount ?? 0);
  const receiptId = sale.sale_number
    ? `MP${String(sale.sale_number).padStart(10, "0")}`
    : `MP${String(sale.id || "")
        .slice(0, 8)
        .toUpperCase()}`;
  const saleDate = sale.created_at ? new Date(sale.created_at).toLocaleDateString("pt-BR") : "";
  const sellerName = data.seller?.name || "—";
  const customerDocument = customer.document ?? customer.cpf ?? customer.cnpj ?? "";
  const customerAddress = customer.address ?? customer.endereco ?? "";
  const customerZip = customer.zip ?? customer.cep ?? "";
  const customerCity = customer.city ?? customer.cidade ?? "";
  const customerState = customer.state ?? customer.estado ?? customer.uf ?? "";
  const payments = data.payments.length
    ? data.payments
    : [{ method: sale.payment_method || "—", amount: total, installments: 1 }];

  return (
    <div className="receipt-print-area mx-auto w-full max-w-[820px] bg-white text-black border border-black/80 shadow-xl print:shadow-none print:border-black">
      <div className="border-b border-black px-3 py-2">
        <p className="text-[13px] font-bold uppercase">
          RECIBO DE {data.org_name} OS PRODUTOS E/OU SERVIÇOS CONSTANTES NO PEDIDO
        </p>
      </div>

      <table className="w-full border-collapse text-[12px]">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1 w-[28%]">Data de recebimento</td>
            <td className="border border-black px-2 py-1">
              Identificação e assinatura do recebedor
            </td>
            <td className="border border-black px-2 py-1 w-[28%]">
              Recibo da venda: <span className="font-bold">{receiptId}</span>
            </td>
          </tr>
          <tr>
            <td className="border border-black px-2 py-6"></td>
            <td className="border border-black px-2 py-6"></td>
            <td className="border border-black px-2 py-6"></td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse text-[12px] border-t-0">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-2 align-middle w-[22%] text-center">
              {data.org?.logo_url ? (
                <img
                  src={data.org.logo_url}
                  alt={data.org_name}
                  className="mx-auto max-h-[70px] object-contain"
                />
              ) : (
                <div className="text-[11px] text-neutral-500">{data.org_name}</div>
              )}
            </td>
            <td className="border border-black px-3 py-2 text-center align-middle">
              <p className="font-bold">{data.org_name}</p>
              {data.org?.cnpj && <p>CNPJ: {data.org.cnpj}</p>}
              {data.org?.phone && <p>Telefone: {data.org.phone}</p>}
              {data.org?.address && <p className="text-[11px]">{data.org.address}</p>}
            </td>
            <td className="border border-black px-3 py-2 align-top w-[28%]">
              <p>
                <span className="font-bold">{saleDate}</span>
              </p>
              <p>
                <span className="font-bold">VENDEDOR:</span> {sellerName}
              </p>
              <p>
                <span className="font-bold">RECIBO DA VENDA:</span> {receiptId}
              </p>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="px-3 pt-3 pb-1">
        <p className="text-[12px] font-bold">DESTINATÁRIO/REMETENTE</p>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-neutral-50">
            <th className="border border-black px-2 py-1 text-center font-bold">
              Nome/Razão social
            </th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[18%]">
              Telefone
            </th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[18%]">
              CPF/CNPJ
            </th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[22%]">E-mail</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black px-2 py-1">{customer.name || "—"}</td>
            <td className="border border-black px-2 py-1">{customer.phone || ""}</td>
            <td className="border border-black px-2 py-1">{customerDocument}</td>
            <td className="border border-black px-2 py-1">{customer.email || ""}</td>
          </tr>
          <tr className="bg-neutral-50">
            <th className="border border-black px-2 py-1 text-center font-bold">Endereço</th>
            <th className="border border-black px-2 py-1 text-center font-bold">CEP</th>
            <th className="border border-black px-2 py-1 text-center font-bold">Cidade</th>
            <th className="border border-black px-2 py-1 text-center font-bold">Estado</th>
          </tr>
          <tr>
            <td className="border border-black px-2 py-1">{customerAddress}</td>
            <td className="border border-black px-2 py-1">{customerZip}</td>
            <td className="border border-black px-2 py-1">{customerCity}</td>
            <td className="border border-black px-2 py-1">{customerState}</td>
          </tr>
        </tbody>
      </table>

      <div className="px-3 pt-3 pb-1">
        <p className="text-[12px] font-bold">DADOS DO PRODUTO</p>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-neutral-50">
            <th className="border border-black px-2 py-1 text-center font-bold w-[10%]">Cód</th>
            <th className="border border-black px-2 py-1 text-center font-bold">Produto</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[6%]">Qtd</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[14%]">
              Valor Unitário
            </th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[12%]">
              Desconto
            </th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[14%]">
              Valor Total
            </th>
          </tr>
        </thead>
        <tbody>
          {(data.items.length
            ? data.items
            : [
                {
                  id: "empty",
                  product_name: "Itens da venda",
                  quantity: 1,
                  unit_price: total,
                  total,
                },
              ]
          ).map((item: any) => {
            const description = buildReceiptItemDescription(item, {
              brand: item.brand,
              model: item.model,
              category: item.category,
              metadata: item.metadata,
              sku: item.sku,
              id: item.product_id,
              name: item.product_name,
            });
            return (
              <tr key={item.id}>
                <td className="border border-black px-2 py-1 align-top">
                  {toProductCode({ id: item.product_id, sku: item.sku })}
                </td>
                <td className="border border-black px-2 py-1 align-top">{description}</td>
                <td className="border border-black px-2 py-1 align-top text-center">
                  {item.quantity}
                </td>
                <td className="border border-black px-2 py-1 align-top text-right">
                  {formatCurrency(Number(item.unit_price))}
                </td>
                <td className="border border-black px-2 py-1 align-top text-right">
                  {item.discount ? formatCurrency(Number(item.discount)) : "R$"}
                </td>
                <td className="border border-black px-2 py-1 align-top text-right">
                  {formatCurrency(Number(item.total))}
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="border border-black px-2 py-1 text-right font-bold" colSpan={3}>
              Total
            </td>
            <td className="border border-black px-2 py-1 text-right font-bold">
              {formatCurrency(Number(sale.subtotal ?? total))}
            </td>
            <td className="border border-black px-2 py-1 text-right font-bold">
              {sale.discount ? formatCurrency(Number(sale.discount)) : "R$"}
            </td>
            <td className="border border-black px-2 py-1 text-right font-bold">
              {formatCurrency(total)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="px-3 pt-3 pb-1">
        <p className="text-[12px] font-bold">PAGAMENTO</p>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-neutral-50">
            <th className="border border-black px-2 py-1 text-center font-bold w-[25%]">
              Forma de Pagamento
            </th>
            <th className="border border-black px-2 py-1 text-center font-bold">Detalhes</th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[20%]">
              Valor Pago
            </th>
            <th className="border border-black px-2 py-1 text-center font-bold w-[12%]">
              Parcelas
            </th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment: any, index: number) => (
            <tr key={index}>
              <td className="border border-black px-2 py-1">
                {METHOD_LABEL[payment.method] || payment.method}
              </td>
              <td className="border border-black px-2 py-1"></td>
              <td className="border border-black px-2 py-1 text-right">
                {formatCurrency(Number(payment.amount))}
              </td>
              <td className="border border-black px-2 py-1 text-center">
                {payment.installments ?? 1}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-black px-2 py-1 text-right font-bold" colSpan={2}>
              Total
            </td>
            <td className="border border-black px-2 py-1 text-right font-bold">
              {formatCurrency(total)}
            </td>
            <td className="border border-black px-2 py-1"></td>
          </tr>
        </tbody>
      </table>

      <div className="px-3 pt-4">
        <p className="text-[12px] font-bold">OBSERVAÇÃO</p>
        <div className="h-6"></div>
        <p className="text-[12px] font-bold">DADOS ADICIONAIS</p>
        <div className="h-10"></div>
      </div>
      <div className="px-6 pb-3 pt-6 grid grid-cols-2 gap-10 text-center text-[12px]">
        <div>
          <div className="border-t border-black pt-1">{customer.name || ""}</div>
        </div>
        <div>
          <div className="border-t border-black pt-1">{data.org_name}</div>
        </div>
      </div>
      <div className="text-center text-[12px] py-3">OBRIGADO PELA PREFERÊNCIA.</div>

      <style>{`
        @media print {
          @page { margin: 10mm; size: A4; }
          body * { visibility: hidden !important; }
          .receipt-print-area, .receipt-print-area * { visibility: visible !important; }
          .receipt-print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; border-color: #000 !important; }
        }
      `}</style>
    </div>
  );
}

function Receipt80mm({ data }: { data: ReceiptData }) {
  const sale = data.sale || {};
  const customer = data.customer || {};
  const total = Number(sale.total_amount ?? 0);
  const subtotal = Number(sale.subtotal ?? total);
  const discount = Number(sale.discount ?? 0);
  const receiptNumber = sale.sale_number
    ? String(sale.sale_number).padStart(7, "0")
    : String(sale.id || "")
        .slice(0, 7)
        .toUpperCase();
  const saleDate = sale.created_at ? new Date(sale.created_at).toLocaleDateString("pt-BR") : "";
  const sellerName = data.seller?.name || "—";
  const customerDocument = customer.document ?? customer.cpf ?? customer.cnpj ?? "";
  const customerAddress = [
    customer.address ?? customer.endereco,
    customer.neighborhood ?? customer.bairro,
    customer.city ?? customer.cidade,
    customer.state ?? customer.estado ?? customer.uf,
  ]
    .filter(Boolean)
    .join(", ");
  const payments = data.payments.length
    ? data.payments
    : [{ method: sale.payment_method || "—", amount: total, installments: 1 }];
  const deliveryType = sale.delivery_type || sale.channel || "Retirada";

  return (
    <div
      className="receipt-print-area mx-auto bg-white text-black shadow-xl print:shadow-none"
      style={{
        width: "80mm",
        padding: "4mm",
        fontFamily: "'Courier New', ui-monospace, monospace",
        fontSize: "11px",
        lineHeight: 1.35,
      }}
    >
      <div className="text-center">
        <div className="font-bold text-[12px]">Nº {receiptNumber}</div>
        {data.org?.logo_url && (
          <img
            src={data.org.logo_url}
            alt={data.org_name}
            className="mx-auto my-1 receipt-logo"
            style={{
              maxHeight: "55px",
              objectFit: "contain",
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          />
        )}
        <div className="font-bold text-[13px]">{data.org_name}</div>
      </div>

      <div className="mt-2 space-y-0.5">
        {data.org?.cnpj && (
          <div>
            <span className="font-bold">CNPJ:</span> {data.org.cnpj}
          </div>
        )}
        {data.org?.address && (
          <div>
            <span className="font-bold">Endereço:</span> {data.org.address}
          </div>
        )}
        {data.org?.phone && (
          <div>
            <span className="font-bold">Fone:</span> {data.org.phone}
          </div>
        )}
      </div>

      <div className="mt-2 space-y-0.5">
        <div>
          <span className="font-bold">Vendedor(a):</span> {sellerName}
        </div>
        <div>
          <span className="font-bold">Data da venda:</span> {saleDate}
        </div>
        <div>
          <span className="font-bold">Tipo de Entrega:</span> {deliveryType}
        </div>
      </div>

      <div className="mt-2">
        <div className="font-bold">DADOS DO CLIENTE</div>
        <div>
          <span className="font-bold">Cliente:</span> {customer.name || "—"}
        </div>
        {customerDocument && (
          <div>
            <span className="font-bold">CNPJ/CPF:</span> {customerDocument}
          </div>
        )}
        {customerAddress && (
          <div>
            <span className="font-bold">Endereço:</span> {customerAddress}
          </div>
        )}
        {customer.phone && (
          <div>
            <span className="font-bold">Fone:</span> {customer.phone}
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="font-bold">PRODUTOS</div>
        <table className="w-full text-[10.5px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="border-b border-black">
              <th className="text-left font-bold py-0.5">Produto</th>
              <th className="text-center font-bold w-7">Qtd</th>
              <th className="text-right font-bold w-12">Valor</th>
              <th className="text-right font-bold w-12">Desc</th>
              <th className="text-right font-bold w-14">Total</th>
            </tr>
          </thead>
          <tbody>
            {(data.items.length
              ? data.items
              : [
                  {
                    id: "empty",
                    product_name: "Itens da venda",
                    quantity: 1,
                    unit_price: total,
                    total,
                    discount: 0,
                  },
                ]
            ).map((item: any) => {
              const description = buildReceiptItemDescription(item, {
                brand: item.brand,
                model: item.model,
                category: item.category,
                metadata: item.metadata,
                sku: item.sku,
                id: item.product_id,
                name: item.product_name,
              });
              return (
                <tr key={item.id} className="align-top">
                  <td className="py-0.5 pr-1 break-words">{description}</td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">{formatCurrency(Number(item.unit_price))}</td>
                  <td className="text-right">
                    {item.discount ? formatCurrency(Number(item.discount)) : "-"}
                  </td>
                  <td className="text-right">{formatCurrency(Number(item.total))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-black mt-1 pt-1 flex justify-between font-bold">
          <span>Total (R$):</span>
          <span>{formatCurrency(subtotal - discount || total)}</span>
        </div>
      </div>

      <div className="mt-2">
        <div className="font-bold">PAGAMENTO</div>
        <table className="w-full text-[10.5px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="border-b border-black">
              <th className="text-left font-bold py-0.5">Forma de pagamento</th>
              <th className="text-left font-bold">Detalhes</th>
              <th className="text-right font-bold w-14">Valor (R$)</th>
              <th className="text-center font-bold w-10">Parc.</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment: any, index: number) => (
              <tr key={index} className="align-top">
                <td className="py-0.5 pr-1">{METHOD_LABEL[payment.method] || payment.method}</td>
                <td className="pr-1">{payment.reference || ""}</td>
                <td className="text-right">{formatCurrency(Number(payment.amount))}</td>
                <td className="text-center">{payment.installments ?? 1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <div>Obs: {sale.notes || ""}</div>
        <div className="mt-6 border-t border-black pt-1 text-center text-[10px]">
          Assinatura do cliente
        </div>
      </div>

      <div className="mt-3 text-center text-[10px] border-t border-dashed border-black pt-2">
        Atenção! Esse documento não possui valor fiscal.
        <br />
        Obrigado!
      </div>

      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden !important; }
          .receipt-print-area, .receipt-print-area * { visibility: visible !important; }
          .receipt-print-area { position: absolute !important; left: 0 !important; top: 0 !important; box-shadow: none !important; width: 80mm !important; }
          .receipt-print-area img { display: block !important; max-width: 100% !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
