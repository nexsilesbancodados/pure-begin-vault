import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, AlertCircle, FileText } from "lucide-react";

export const Route = createFileRoute("/orcamento/$id")({
  head: () => ({
    meta: [{ title: "Orçamento" }],
  }),
  component: OrcamentoPage,
});

type Data = {
  quote: {
    id: string;
    sale_number: number | null;
    created_at: string;
    subtotal: number | null;
    discount: number | null;
    addition: number | null;
    total_amount: number | null;
    notes: string | null;
    status: string | null;
  };
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    discount: number | null;
  }>;
  org_name: string;
  customer: {
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

function OrcamentoPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/quote/${encodeURIComponent(id)}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Orçamento não encontrado" : "Erro ao carregar");
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

  const dt = new Date(data.quote.created_at).toLocaleDateString("pt-BR");
  const validUntil = new Date(
    new Date(data.quote.created_at).getTime() + 7 * 86400000,
  ).toLocaleDateString("pt-BR");
  const total = Number(data.quote.total_amount ?? 0);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white p-4 print:p-0">
      <div className="quote mx-auto bg-white text-black border border-gray-200 print:border-0 max-w-3xl p-8 print:p-6 shadow print:shadow-none">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-300 pb-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">{data.org_name}</p>
            <h1 className="text-3xl font-black mt-1">Orçamento</h1>
            <p className="text-xs text-gray-600 mt-1">
              Nº{" "}
              {data.quote.sale_number
                ? `#${data.quote.sale_number}`
                : data.quote.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <FileText className="h-12 w-12 text-gray-300" />
        </div>

        {/* Cliente + datas */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-gray-500 mb-1">
              Cliente
            </p>
            {data.customer ? (
              <>
                <p className="font-bold">{data.customer.name}</p>
                {data.customer.document && (
                  <p className="text-xs text-gray-600">{data.customer.document}</p>
                )}
                {data.customer.phone && (
                  <p className="text-xs text-gray-600">{data.customer.phone}</p>
                )}
                {data.customer.email && (
                  <p className="text-xs text-gray-600">{data.customer.email}</p>
                )}
              </>
            ) : (
              <p className="text-gray-500 italic">Não identificado</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-black text-gray-500 mb-1">
              Datas
            </p>
            <p className="text-sm">
              Emitido: <strong>{dt}</strong>
            </p>
            <p className="text-sm">
              Validade: <strong>{validUntil}</strong>
            </p>
          </div>
        </div>

        {/* Itens */}
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 text-[10px] uppercase tracking-widest font-black text-gray-600">
                Item
              </th>
              <th className="text-center py-2 text-[10px] uppercase tracking-widest font-black text-gray-600">
                Qtd
              </th>
              <th className="text-right py-2 text-[10px] uppercase tracking-widest font-black text-gray-600">
                Unit.
              </th>
              <th className="text-right py-2 text-[10px] uppercase tracking-widest font-black text-gray-600">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it) => (
              <tr key={it.id} className="border-b border-gray-200">
                <td className="py-2">{it.product_name}</td>
                <td className="text-center py-2">{it.quantity}</td>
                <td className="text-right py-2">R$ {Number(it.unit_price).toFixed(2)}</td>
                <td className="text-right py-2 font-bold">R$ {Number(it.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totais */}
        <div className="flex justify-end mb-6">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>R$ {Number(data.quote.subtotal ?? 0).toFixed(2)}</span>
            </div>
            {Number(data.quote.discount ?? 0) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Desconto:</span>
                <span>- R$ {Number(data.quote.discount).toFixed(2)}</span>
              </div>
            )}
            {Number(data.quote.addition ?? 0) > 0 && (
              <div className="flex justify-between">
                <span>Acréscimo:</span>
                <span>+ R$ {Number(data.quote.addition).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-black border-t-2 border-gray-300 pt-2 mt-2">
              <span>TOTAL:</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        {data.quote.notes && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-xs">
            <p className="font-bold mb-1">Observações:</p>
            <p className="whitespace-pre-wrap">{data.quote.notes}</p>
          </div>
        )}

        {/* Termos */}
        <div className="border-t border-gray-300 pt-4 text-[10px] text-gray-600 space-y-1">
          <p>
            <strong>Condições gerais:</strong>
          </p>
          <p>• Este orçamento é válido até {validUntil}.</p>
          <p>• Preços sujeitos a alteração após a validade.</p>
          <p>• Disponibilidade dos produtos sujeita a estoque no momento da compra.</p>
          <p>• Pagamento conforme negociado no ato da compra.</p>
        </div>
      </div>

      <div className="print:hidden text-center mt-4">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white font-bold text-sm"
        >
          <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
        </button>
      </div>

      <style>{`
        @media print {
          @page { margin: 1cm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
