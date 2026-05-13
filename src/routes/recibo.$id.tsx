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
  }>;
  payments: Array<{
    method: string;
    amount: number;
    installments: number | null;
  }>;
  org_name: string;
  customer: { name: string; document: string | null; phone: string | null } | null;
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Dinheiro",
  money: "Dinheiro",
  pix: "Pix",
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

  // imprime automático na 1ª carga se ?auto=1
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("auto") === "1") {
      setTimeout(() => window.print(), 300);
    }
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

  const dt = new Date(data.sale.created_at).toLocaleString("pt-BR");
  const total = Number(data.sale.total_amount ?? 0);
  const subtotal = Number(data.sale.subtotal ?? 0);
  const discount = Number(data.sale.discount ?? 0);
  const addition = Number(data.sale.addition ?? 0);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white p-4 print:p-0">
      <div className="receipt mx-auto bg-white text-black border border-gray-300 print:border-0 max-w-[80mm] p-3 font-mono text-[11px] leading-tight">
        {/* Header */}
        <div className="text-center mb-2">
          <h1 className="font-black text-sm uppercase">{data.org_name}</h1>
          <p className="text-[9px] mt-0.5">Cupom não-fiscal</p>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2"></div>

        {/* Sale info */}
        <div className="text-[10px]">
          <div className="flex justify-between">
            <span>Cupom:</span>
            <span className="font-bold">
              {data.sale.sale_number ? `#${data.sale.sale_number}` : data.sale.id.slice(0, 8)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Data:</span>
            <span>{dt}</span>
          </div>
          {data.customer && (
            <>
              <div className="flex justify-between">
                <span>Cliente:</span>
                <span className="truncate ml-2">{data.customer.name}</span>
              </div>
              {data.customer.document && (
                <div className="flex justify-between">
                  <span>Doc:</span>
                  <span>{data.customer.document}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2"></div>

        {/* Items */}
        <div className="text-[10px] space-y-1">
          {data.items.map((it) => (
            <div key={it.id}>
              <div className="flex justify-between">
                <span className="truncate flex-1 pr-1">
                  {it.quantity}x {it.product_name}
                </span>
                <span className="shrink-0 font-bold">{Number(it.total).toFixed(2)}</span>
              </div>
              {it.imei && <p className="text-[8px] text-gray-600">IMEI: {it.imei}</p>}
              {it.discount != null && Number(it.discount) > 0 && (
                <p className="text-[8px] text-gray-600">
                  Desc.: -R$ {Number(it.discount).toFixed(2)}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2"></div>

        {/* Totals */}
        <div className="text-[11px] space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <span>Desconto:</span>
              <span>- R$ {discount.toFixed(2)}</span>
            </div>
          )}
          {addition > 0 && (
            <div className="flex justify-between">
              <span>Acréscimo:</span>
              <span>+ R$ {addition.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-[13px] mt-1">
            <span>TOTAL:</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-gray-400 my-2"></div>

        {/* Payments */}
        <div className="text-[10px]">
          <p className="font-bold mb-1">Pagamento{data.payments.length > 1 ? "s" : ""}:</p>
          {data.payments.length === 0 ? (
            <p>{METHOD_LABEL[data.sale.payment_method ?? ""] || data.sale.payment_method || "—"}</p>
          ) : (
            data.payments.map((p, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {METHOD_LABEL[p.method] || p.method}
                  {p.installments && p.installments > 1 && ` (${p.installments}x)`}:
                </span>
                <span>R$ {Number(p.amount).toFixed(2)}</span>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-dashed border-gray-400 my-2"></div>

        <div className="text-center text-[9px] mt-2">
          <p>Obrigado pela preferência!</p>
          <p className="mt-1 text-[8px] text-gray-600">
            Este documento NÃO É NOTA FISCAL.
            <br />
            Apenas comprovante interno.
          </p>
        </div>
      </div>

      {/* Botão imprimir (oculto na impressão) */}
      <div className="print:hidden text-center mt-4">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white font-bold text-sm"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { background: white !important; }
          .receipt { border: 0 !important; max-width: none !important; width: 100%; }
        }
      `}</style>
    </div>
  );
}
