import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/recibo/$id")({
  head: () => ({
    meta: [{ title: "Cupom de venda" }],
  }),
  component: ReciboPage,
});

type Receipt = {
  sale: {
    id: string;
    sale_number: number | null;
    created_at: string;
    payment_method: string | null;
    subtotal: number | null;
    discount: number | null;
    addition: number | null;
    total_amount: number | null;
    channel: string | null;
  };
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    imei: string | null;
    discount: number | null;
    model?: string | null;
  }>;
  payments: Array<{
    method: string;
    amount: number;
    installments: number | null;
  }>;
  org_name: string;
  org?: {
    address?: string | null;
    cnpj?: string | null;
    phone?: string | null;
    website?: string | null;
  } | null;
  seller?: { name?: string | null } | null;
  customer: { name: string; document: string | null; phone: string | null } | null;
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

function ReciboPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/receipt/${encodeURIComponent(id)}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Cupom não encontrado" : "Erro ao carregar");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Erro de conexão");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1") setTimeout(() => window.print(), 300);
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        Carregando...
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black p-6">
        <div className="text-center">
          <AlertCircle className="h-10 w-10 text-red-600 mx-auto mb-3" />
          <p className="font-bold">{error}</p>
        </div>
      </div>
    );
  }

  const dt = new Date(data.sale.created_at).toLocaleDateString("pt-BR");
  const total = Number(data.sale.total_amount ?? 0);
  const subtotal = Number(data.sale.subtotal ?? 0);
  const discount = Number(data.sale.discount ?? 0);
  const addition = Number(data.sale.addition ?? 0);
  const saleRef = data.sale.sale_number
    ? `#${data.sale.sale_number}`
    : `#${data.sale.id.slice(0, 8).toUpperCase()}`;
  const sellerName = data.seller?.name || "—";

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white p-4 print:p-0 flex flex-col items-center">
      <div className="receipt w-full max-w-[360px] bg-white text-black print:border-0 border border-neutral-200 rounded-lg print:rounded-none shadow-sm print:shadow-none overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 text-center">
          <h1 className="font-black text-[18px] tracking-tight uppercase leading-tight">
            {data.org_name}
          </h1>
          {data.org?.address && (
            <p className="text-[11px] text-neutral-600 mt-1">{data.org.address}</p>
          )}
          {data.org?.cnpj && (
            <p className="text-[11px] text-neutral-600 mt-0.5">CNPJ: {data.org.cnpj}</p>
          )}
          {data.org?.phone && (
            <p className="text-[11px] text-neutral-600 mt-0.5">Fone: {data.org.phone}</p>
          )}
        </div>

        <div className="border-t border-dashed border-neutral-400 mx-5"></div>

        {/* Sale info */}
        <div className="px-5 py-3">
          <p className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase mb-2">
            Comprovante de venda
          </p>
          <div className="text-[12px] space-y-0.5">
            <div className="flex justify-between">
              <span className="text-neutral-600">Nº Pedido:</span>
              <span className="font-bold">{saleRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Data:</span>
              <span className="font-medium">{dt}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-600">Vendedor:</span>
              <span className="font-medium truncate ml-2">{sellerName}</span>
            </div>
          </div>
        </div>

        {data.customer && (
          <>
            <div className="border-t border-dashed border-neutral-400 mx-5"></div>
            <div className="px-5 py-3">
              <p className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase mb-2">
                Cliente
              </p>
              <p className="text-[13px] font-bold">{data.customer.name}</p>
              {data.customer.phone && (
                <p className="text-[11px] text-neutral-600 mt-0.5">Tel: {data.customer.phone}</p>
              )}
              {data.customer.document && (
                <p className="text-[11px] text-neutral-600 mt-0.5">Doc: {data.customer.document}</p>
              )}
            </div>
          </>
        )}

        <div className="border-t border-dashed border-neutral-400 mx-5"></div>

        {/* Items */}
        <div className="px-5 py-3">
          <p className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase mb-3">
            Itens do pedido
          </p>
          <div className="space-y-3">
            {data.items.map((it) => (
              <div key={it.id} className="flex justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-black leading-tight">{it.product_name}</p>
                  {it.model && (
                    <p className="text-[10px] text-neutral-500 mt-0.5">Mod: {it.model}</p>
                  )}
                  {it.imei && (
                    <p className="text-[10px] text-neutral-500 mt-0.5">IMEI: {it.imei}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-neutral-500">{it.quantity}x</p>
                  <p className="text-[14px] font-black mt-0.5">
                    R$ {Number(it.total).toFixed(2).replace(".", ",")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="mx-5 my-2 bg-neutral-50 rounded-lg px-4 py-3">
          <div className="flex justify-between text-[12px] py-0.5">
            <span className="text-neutral-600">Subtotal:</span>
            <span className="font-medium">R$ {subtotal.toFixed(2).replace(".", ",")}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-[12px] py-0.5 text-red-600">
              <span>Desconto:</span>
              <span className="font-medium">- R$ {discount.toFixed(2).replace(".", ",")}</span>
            </div>
          )}
          {addition > 0 && (
            <div className="flex justify-between text-[12px] py-0.5">
              <span className="text-neutral-600">Acréscimo:</span>
              <span className="font-medium">+ R$ {addition.toFixed(2).replace(".", ",")}</span>
            </div>
          )}
          <div className="border-t border-neutral-300 my-2"></div>
          <div className="flex justify-between items-baseline">
            <span className="text-[16px] font-black">TOTAL:</span>
            <span className="text-[20px] font-black">
              R$ {total.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-neutral-200 text-[11px] flex items-center justify-between">
            <span className="text-neutral-500 font-bold tracking-wider uppercase">
              Forma de pagto:
            </span>
            <span className="font-black">
              {data.payments.length > 0
                ? data.payments
                    .map(
                      (p) =>
                        `${METHOD_LABEL[p.method] || p.method}${
                          p.installments && p.installments > 1 ? ` ${p.installments}x` : ""
                        }`,
                    )
                    .join(" + ")
                : METHOD_LABEL[data.sale.payment_method ?? ""] ||
                  data.sale.payment_method ||
                  "—"}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 text-center">
          <p className="text-[10px] italic text-neutral-500">
            Este documento não é nota fiscal.
          </p>
          <p className="text-[11px] text-neutral-600 mt-1.5 font-medium">
            Obrigado pela preferência!
          </p>
          {data.org?.website && (
            <p className="text-[10px] text-neutral-500 mt-1">Acesse: {data.org.website}</p>
          )}
        </div>
      </div>

      {/* Botão imprimir */}
      <div className="print:hidden w-full max-w-[360px] mt-3">
        <button
          onClick={() => window.print()}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 font-bold text-sm transition"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { background: white !important; }
          .receipt { border: 0 !important; max-width: none !important; width: 100%; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
