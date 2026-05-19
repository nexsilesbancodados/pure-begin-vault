import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/recibo/$id")({
  head: () => ({ meta: [{ title: "Recibo de venda" }] }),
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
    sku?: string | null;
    product_id?: string | null;
  }>;
  payments: Array<{ method: string; amount: number; installments: number | null }>;
  org_name: string;
  org?: {
    address?: string | null;
    cnpj?: string | null;
    phone?: string | null;
    website?: string | null;
  } | null;
  seller?: { name?: string | null } | null;
  customer:
    | {
        name: string;
        document: string | null;
        phone: string | null;
        email?: string | null;
        address?: string | null;
        zip?: string | null;
        city?: string | null;
        state?: string | null;
      }
    | null;
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

const brl = (n: number) =>
  `R$ ${Number(n || 0)
    .toFixed(2)
    .replace(".", ",")}`;

function ReciboPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/public/receipt/${encodeURIComponent(id)}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Recibo não encontrado" : "Erro ao carregar");
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
    if (params.get("auto") === "1") setTimeout(() => window.print(), 400);
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
  const receiptId = `MP${String(data.sale.sale_number ?? 0).padStart(10, "0")}`;
  const sellerName = data.seller?.name || "—";
  const cust = data.customer;

  return (
    <div className="min-h-screen bg-neutral-200 print:bg-white p-4 print:p-0 flex flex-col items-center">
      <div className="receipt w-full max-w-[820px] bg-white text-black border border-black/80 print:border-black">
        {/* Top heading */}
        <div className="border-b border-black px-3 py-2">
          <p className="text-[13px] font-bold uppercase">
            RECIBO DE {data.org_name} OS PRODUTOS E/OU SERVIÇOS CONSTANTES NO PEDIDO
          </p>
        </div>

        {/* Recipient row */}
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

        {/* Store / sale info */}
        <table className="w-full border-collapse text-[12px] border-t-0">
          <tbody>
            <tr>
              <td className="border border-black px-3 py-2 text-center align-top w-[60%]">
                <p className="font-bold">{data.org_name}</p>
                {data.org?.cnpj && <p>CNPJ: {data.org.cnpj}</p>}
                {data.org?.phone && <p>Telefone: {data.org.phone}</p>}
              </td>
              <td className="border border-black px-3 py-2 align-top">
                <p>
                  <span className="font-bold">{dt}</span>
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

        {/* Customer */}
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
              <th className="border border-black px-2 py-1 text-center font-bold w-[22%]">
                E-mail
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-1">{cust?.name || "—"}</td>
              <td className="border border-black px-2 py-1">{cust?.phone || ""}</td>
              <td className="border border-black px-2 py-1">{cust?.document || ""}</td>
              <td className="border border-black px-2 py-1">{cust?.email || ""}</td>
            </tr>
            <tr className="bg-neutral-50">
              <th className="border border-black px-2 py-1 text-center font-bold">Endereço</th>
              <th className="border border-black px-2 py-1 text-center font-bold">CEP</th>
              <th className="border border-black px-2 py-1 text-center font-bold">Cidade</th>
              <th className="border border-black px-2 py-1 text-center font-bold">Estado</th>
            </tr>
            <tr>
              <td className="border border-black px-2 py-1">{cust?.address || ""}</td>
              <td className="border border-black px-2 py-1">{cust?.zip || ""}</td>
              <td className="border border-black px-2 py-1">{cust?.city || ""}</td>
              <td className="border border-black px-2 py-1">{cust?.state || ""}</td>
            </tr>
          </tbody>
        </table>

        {/* Products */}
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
            {data.items.map((it) => {
              const desc: string[] = [it.product_name];
              if (it.imei) desc.push(`IMEI: ${it.imei}`);
              if (it.model) desc.push(it.model);
              return (
                <tr key={it.id}>
                  <td className="border border-black px-2 py-1 align-top">
                    {toProductCode({ id: it.product_id, sku: it.sku })}
                  </td>
                  <td className="border border-black px-2 py-1 align-top">{desc.join(" - ")}</td>
                  <td className="border border-black px-2 py-1 align-top text-center">
                    {it.quantity}
                  </td>
                  <td className="border border-black px-2 py-1 align-top text-right">
                    {brl(Number(it.unit_price))}
                  </td>
                  <td className="border border-black px-2 py-1 align-top text-right">
                    {it.discount ? brl(Number(it.discount)) : "R$"}
                  </td>
                  <td className="border border-black px-2 py-1 align-top text-right">
                    {brl(Number(it.total))}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td
                className="border border-black px-2 py-1 text-right font-bold"
                colSpan={3}
              >
                Total
              </td>
              <td className="border border-black px-2 py-1 text-right font-bold">
                {brl(Number(data.sale.subtotal ?? total))}
              </td>
              <td className="border border-black px-2 py-1 text-right font-bold">
                {data.sale.discount ? brl(Number(data.sale.discount)) : "R$"}
              </td>
              <td className="border border-black px-2 py-1 text-right font-bold">{brl(total)}</td>
            </tr>
          </tbody>
        </table>

        {/* Payment */}
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
            {(data.payments.length > 0
              ? data.payments
              : [
                  {
                    method: data.sale.payment_method || "—",
                    amount: total,
                    installments: 1,
                  },
                ]
            ).map((p, i) => (
              <tr key={i}>
                <td className="border border-black px-2 py-1">
                  {METHOD_LABEL[p.method] || p.method}
                </td>
                <td className="border border-black px-2 py-1"></td>
                <td className="border border-black px-2 py-1 text-right">{brl(Number(p.amount))}</td>
                <td className="border border-black px-2 py-1 text-center">{p.installments ?? 1}</td>
              </tr>
            ))}
            <tr>
              <td className="border border-black px-2 py-1 text-right font-bold" colSpan={2}>
                Total
              </td>
              <td className="border border-black px-2 py-1 text-right font-bold">{brl(total)}</td>
              <td className="border border-black px-2 py-1"></td>
            </tr>
          </tbody>
        </table>

        {/* Observations */}
        <div className="px-3 pt-4">
          <p className="text-[12px] font-bold">OBSERVAÇÃO</p>
          <div className="h-6"></div>
          <p className="text-[12px] font-bold">DADOS ADICIONAIS</p>
          <div className="h-10"></div>
        </div>

        {/* Signatures */}
        <div className="px-6 pb-3 pt-6 grid grid-cols-2 gap-10 text-center text-[12px]">
          <div>
            <div className="border-t border-black pt-1">{cust?.name || ""}</div>
          </div>
          <div>
            <div className="border-t border-black pt-1">{data.org_name}</div>
          </div>
        </div>

        <div className="text-center text-[12px] py-3">OBRIGADO PELA PREFERÊNCIA.</div>
      </div>

      <div className="print:hidden w-full max-w-[820px] mt-3">
        <button
          onClick={() => window.print()}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-sm transition"
        >
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      <style>{`
        @media print {
          @page { margin: 10mm; size: A4; }
          body { background: white !important; }
          .receipt { border-color: #000 !important; max-width: none !important; width: 100%; }
        }
      `}</style>
    </div>
  );
}
