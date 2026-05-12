import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, AlertCircle, Smartphone } from "lucide-react";

export const Route = createFileRoute("/os-termo/$id")({
  head: () => ({
    meta: [{ title: "Termo de Recebimento — OS" }],
  }),
  component: OsTermoPage,
});

type Data = {
  os: {
    id: string;
    os_number: number | null;
    created_at: string;
    equipment: string;
    brand: string | null;
    model: string | null;
    imei: string | null;
    serial: string | null;
    accessories: string | null;
    problem_description: string | null;
    estimated_cost: number | null;
    warranty_days: number | null;
    due_date: string | null;
    password_pattern: string | null;
  };
  org_name: string;
};

function OsTermoPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/os-public/${encodeURIComponent(id)}`);
        if (!res.ok) {
          setError(res.status === 404 ? "OS não encontrada" : "Erro");
          return;
        }
        const j = await res.json();
        setData({ os: j.os, org_name: j.org_name });
      } catch {
        setError("Erro de conexão");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white text-black">Carregando...</div>;
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

  const dt = new Date(data.os.created_at).toLocaleDateString("pt-BR");

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white p-4 print:p-0">
      <div className="termo mx-auto bg-white text-black border border-gray-200 print:border-0 max-w-3xl p-8 print:p-6 shadow print:shadow-none text-sm">
        <div className="flex items-start justify-between border-b border-gray-300 pb-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest">{data.org_name}</p>
            <h1 className="text-2xl font-black mt-1">Termo de Recebimento</h1>
            <p className="text-xs text-gray-600">
              OS {data.os.os_number ? `#${data.os.os_number}` : data.os.id.slice(0, 8)} · {dt}
            </p>
          </div>
          <Smartphone className="h-10 w-10 text-gray-300" />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Equipamento" value={data.os.equipment} />
          <Field label="Marca / Modelo" value={[data.os.brand, data.os.model].filter(Boolean).join(" / ") || "—"} />
          <Field label="IMEI" value={data.os.imei || "—"} mono />
          <Field label="Serial" value={data.os.serial || "—"} mono />
          <Field label="Acessórios entregues" value={data.os.accessories || "Sem acessórios"} />
          <Field label="Senha / Padrão" value={data.os.password_pattern || "Não informado"} mono />
        </div>

        <Field label="Problema relatado" value={data.os.problem_description || "—"} full />

        <div className="grid grid-cols-3 gap-4 mt-4 mb-6">
          <Field label="Orçamento estimado" value={data.os.estimated_cost != null ? `R$ ${Number(data.os.estimated_cost).toFixed(2)}` : "A diagnosticar"} />
          <Field label="Previsão" value={data.os.due_date ? new Date(data.os.due_date).toLocaleDateString("pt-BR") : "A definir"} />
          <Field label="Garantia (dias)" value={data.os.warranty_days != null ? `${data.os.warranty_days}` : "—"} />
        </div>

        {/* Termos legais */}
        <div className="mt-4 pt-4 border-t border-gray-300 text-[10px] text-gray-700 space-y-1.5 leading-snug">
          <p><strong>Cláusulas — leia com atenção:</strong></p>
          <p>1. O cliente declara que entregou o equipamento descrito acima, com os acessórios listados, para conserto.</p>
          <p>2. O orçamento estimado é prévio. Após análise técnica, novo orçamento pode ser apresentado, com aprovação do cliente antes do reparo.</p>
          <p>3. Equipamentos não retirados em 90 dias após aviso de conclusão serão considerados abandonados, conforme art. 1.275 do Código Civil.</p>
          <p>4. A garantia cobre apenas o serviço executado e peças instaladas. Não cobre quedas, líquidos, mau uso ou alterações por terceiros.</p>
          <p>5. Dados eventualmente armazenados no aparelho são de inteira responsabilidade do cliente. A loja não se responsabiliza por perda.</p>
          <p>6. O cliente autoriza a manipulação do aparelho para fins exclusivos do reparo, incluindo desbloqueio quando necessário e informado.</p>
        </div>

        {/* Assinaturas */}
        <div className="grid grid-cols-2 gap-12 mt-12">
          <div className="text-center">
            <div className="border-t border-black pt-1">
              <p className="text-xs font-bold">Cliente</p>
              <p className="text-[10px] text-gray-600">Li e concordo com os termos acima</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-1">
              <p className="text-xs font-bold">{data.org_name}</p>
              <p className="text-[10px] text-gray-600">Responsável pelo recebimento</p>
            </div>
          </div>
        </div>
      </div>

      <div className="print:hidden text-center mt-4">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white font-bold text-sm">
          <Printer className="h-4 w-4" /> Imprimir 2 vias
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

function Field({ label, value, full, mono }: { label: string; value: string; full?: boolean; mono?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-[9px] uppercase tracking-widest font-black text-gray-500">{label}</p>
      <p className={`text-sm ${mono ? "font-mono" : ""} font-bold`}>{value}</p>
    </div>
  );
}
