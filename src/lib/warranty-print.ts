// Gerador unificado do Termo de Garantia (org-aware).
// Busca dados reais da venda/loja/cliente e abre uma janela de impressão.
import { supabase } from "@/integrations/supabase/client";
import { buildReceiptItemDescription } from "@/lib/receipt-format";

export type WarrantyType = "seminovo" | "lacrado" | "android";

const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  money: "Dinheiro",
  pix: "PIX",
  card: "Cartão",
  credit: "Cartão crédito",
  debit: "Cartão débito",
  installment: "Parcelado",
  transfer: "Transferência",
  crediario: "Crediário",
  brasilcard: "BrasilCard",
  prazo7d: "Prazo 7d",
  other: "Aparelho",
  aparelho: "Aparelho",
};

export async function openWarrantyPrintWindow(
  saleId: string,
  orgId: string,
  type: WarrantyType,
) {
  if (!saleId || !orgId) throw new Error("Dados insuficientes para gerar o termo");

  const [saleRes, itemsRes, paymentsRes] = await Promise.all([
    (supabase as any)
      .from("sales_orders")
      .select("*")
      .eq("id", saleId)
      .eq("organization_id", orgId)
      .maybeSingle(),
    (supabase as any).from("sale_items").select("*").eq("sale_id", saleId).eq("organization_id", orgId),
    (supabase as any).from("sale_payments").select("*").eq("sale_id", saleId).eq("organization_id", orgId),
  ]);
  const fullSale = saleRes.data;
  if (!fullSale) throw new Error("Venda não encontrada");

  const [{ data: org }, { data: orgSettings }, { data: customer }, { data: seller }] =
    await Promise.all([
      (supabase as any).from("organizations").select("name").eq("id", orgId).maybeSingle(),
      (supabase as any).from("organization_settings").select("*").eq("organization_id", orgId).maybeSingle(),
      fullSale.customer_id
        ? (supabase as any)
            .from("customers")
            .select("*")
            .eq("id", fullSale.customer_id)
            .eq("organization_id", orgId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      fullSale.seller_id
        ? (supabase as any)
            .from("profiles")
            .select("full_name, email")
            .eq("id", fullSale.seller_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const settings: any = orgSettings || {};
  const orgName = settings.brand_name || org?.name || "Loja";
  let extras: { cnpj?: string; address?: string } = {};
  try {
    if (typeof window !== "undefined") {
      extras = JSON.parse(localStorage.getItem(`store-details:${orgId}`) || "{}");
    }
  } catch {}
  const cnpj = extras.cnpj ?? settings.cnpj ?? settings.document ?? "";
  const phone = settings.support_whatsapp ?? settings.phone ?? settings.telefone ?? "";
  const address = extras.address ?? settings.address ?? settings.endereco ?? "";
  const logo = settings.brand_logo_url ?? "";
  const sellerName = seller?.full_name || seller?.email || "—";
  const cust: any = customer || {};

  const titles: Record<WarrantyType, string> = {
    seminovo: "Termo de Garantia - Seminovo (7 meses)",
    lacrado: "Termo de Garantia - Lacrado (1 ano)",
    android: "Termo de Garantia - Aparelho Android (1 ano)",
  };

  const start = new Date(fullSale.created_at || Date.now());
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
  const receiptId = fullSale.sale_number
    ? `MP${String(fullSale.sale_number).padStart(10, "0")}`
    : `#${String(fullSale.id).slice(0, 8).toUpperCase()}`;
  const brl = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

  const items: any[] = itemsRes.data || [];
  const payments: any[] = paymentsRes.data || [];
  const total = Number(fullSale.total_amount ?? 0);
  const subtotal = Number(fullSale.subtotal ?? total);
  const discount = Number(fullSale.discount ?? 0);

  const productIds = Array.from(new Set(items.map((it) => it.product_id).filter(Boolean)));
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
              <td>${String(it.product_id || it.sku || "").slice(0, 8)}</td>
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

  const seminovoClauses = `
<p class="ctitle">DO OBJETO</p>
<p><b>Cláusula 1ª:</b> O comprador está adquirindo o produto descrito acima, em plenas condições de uso, devidamente testado, concordando com todas as características e estado do item, inexistindo qualquer defeito, mediante valor e forma de pagamento ajustado entre as partes.</p>
<p><b>Cláusula 2ª:</b> Por tratar-se de um aparelho seminovo, todas as informações e características do produto foram repassadas pelo vendedor no ato da compra.</p>
<p class="ctitle">DA GARANTIA DO PRODUTO</p>
<p><b>Cláusula 3ª:</b> A garantia será de <b>7 meses</b>, contados do recebimento ou retirada em loja do produto, respeitando o Código de Defesa do Consumidor e será prestada pela própria ${orgName} ou terceiros indicados pela mesma.</p>
<p><b>Cláusula 4ª:</b> A garantia do produto cessará em casos de mau uso, queda, contato com líquidos, reparo por terceiros não autorizados, modificação de software ou violação de lacre.</p>`;

  const lacradoClauses = `
<p class="ctitle">DO OBJETO</p>
<p><b>Cláusula 1ª:</b> O comprador está adquirindo o produto descrito acima, em plenas condições de uso, devidamente lacrado, testado, concordando com todas as características.</p>
<p class="ctitle">DA GARANTIA DO PRODUTO</p>
<p><b>Cláusula 2ª:</b> A garantia do produto terá validade por <b>12 meses</b>, contados do recebimento ou retirada em loja, fornecida pelo próprio fabricante.</p>
<p><b>Cláusula 3ª:</b> A garantia cessará em casos de mau uso, queda, contato com líquidos, reparo por terceiros não autorizados ou violação de lacre.</p>`;

  const androidClauses = `
<p class="ctitle">DO OBJETO</p>
<p><b>Cláusula 1ª:</b> O comprador está adquirindo aparelho Android em plenas condições de uso, devidamente testado.</p>
<p class="ctitle">DA GARANTIA DO PRODUTO</p>
<p><b>Cláusula 2ª:</b> A garantia terá validade por <b>12 meses</b>, fornecida pelo fabricante, conforme procedimentos da assistência autorizada.</p>
<p><b>Cláusula 3ª:</b> A garantia cessará em casos de mau uso, queda, contato com líquidos, reparo por terceiros não autorizados ou modificação de software (Root).</p>`;

  const clauses =
    type === "seminovo" ? seminovoClauses : type === "lacrado" ? lacradoClauses : androidClauses;

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
.clauses{margin-top:16px;}
.clauses p{margin:6px 0;text-align:justify;}
.ctitle{font-weight:bold;text-transform:uppercase;margin-top:14px !important;text-align:center;letter-spacing:.4px;}
.sign{margin-top:48px;display:flex;justify-content:space-between;gap:40px;}
.sign div{flex:1;text-align:center;border-top:1px solid #000;padding-top:4px;font-size:11px;}
.thanks{text-align:center;font-weight:bold;margin:18px 0 6px;font-size:12px;}
.no-print{margin-top:24px;text-align:center;}
.no-print button{padding:10px 20px;background:#000;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;}
@media print{body{padding:10mm;}@page{size:A4;margin:10mm;} .no-print{display:none;}}
</style></head><body>
<div class="head-title">RECIBO DE ${orgName.toUpperCase()} - PRODUTOS E/OU SERVIÇOS</div>
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
    <td class="store-info" style="width:22%;">${logo ? `<img src="${logo}" alt="${orgName}"/>` : `<b>${orgName}</b>`}</td>
    <td class="store-info"><b>${orgName}</b><br/>${cnpj ? `CNPJ: ${cnpj}<br/>` : ""}${phone ? `Telefone: ${phone}<br/>` : ""}${address ? `<span style="font-size:11px;">${address}</span>` : ""}</td>
    <td style="width:28%;"><b>${fmt(start)}</b><br/><b>VENDEDOR:</b> ${sellerName}<br/><b>RECIBO:</b> ${receiptId}</td>
  </tr>
</table>
<div class="section-label">DESTINATÁRIO</div>
<table>
  <tr><th>Nome/Razão social</th><th style="width:18%;">Telefone</th><th style="width:18%;">CPF/CNPJ</th><th style="width:22%;">E-mail</th></tr>
  <tr><td>${cust.name || ""}</td><td>${cust.phone || ""}</td><td>${cust.document || cust.cpf || cust.cnpj || ""}</td><td>${cust.email || ""}</td></tr>
  <tr><th>Endereço</th><th>CEP</th><th>Cidade</th><th>Estado</th></tr>
  <tr><td>${cust.address || cust.endereco || ""}</td><td>${cust.zip || cust.cep || ""}</td><td>${cust.city || cust.cidade || ""}</td><td>${cust.state || cust.uf || ""}</td></tr>
</table>
<div class="section-label">DADOS DO PRODUTO</div>
<table>
  <tr><th style="width:9%;">Cód</th><th>Produto</th><th style="width:6%;">Qtd</th><th style="width:13%;">Valor Unitário</th><th style="width:11%;">Desconto</th><th style="width:13%;">Valor Total</th></tr>
  ${itemsRows}
  <tr><td colspan="3" class="text-right"><b>Total</b></td><td class="text-right"><b>${brl(subtotal)}</b></td><td class="text-right"><b>${discount ? brl(discount) : "R$"}</b></td><td class="text-right"><b>${brl(total)}</b></td></tr>
</table>
<div class="section-label">PAGAMENTO</div>
<table>
  <tr><th style="width:25%;">Forma de Pagamento</th><th>Detalhes</th><th style="width:20%;">Valor Pago</th><th style="width:12%;">Parcelas</th></tr>
  ${paymentRows}
  <tr><td colspan="2" class="text-right"><b>Total</b></td><td class="text-right"><b>${brl(total)}</b></td><td></td></tr>
</table>
<div class="section-label">DADOS ADICIONAIS - ${titles[type].toUpperCase()}</div>
<div class="clauses">${clauses}</div>
<div class="sign"><div>${cust.name || ""}</div><div>${orgName}</div></div>
<div class="thanks">OBRIGADO PELA PREFERÊNCIA.</div>
<div class="no-print"><button onclick="window.print()">Imprimir</button></div>
<script>window.onload=function(){setTimeout(function(){window.print()}, 400);};</script>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) throw new Error("Pop-up bloqueado. Permita pop-ups para imprimir.");
  win.document.write(html);
  win.document.close();
}
