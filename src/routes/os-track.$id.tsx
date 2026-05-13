import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Wrench,
  CheckCircle2,
  Clock,
  Phone,
  Calendar,
  Smartphone,
  AlertCircle,
  Package,
} from "lucide-react";

export const Route = createFileRoute("/os-track/$id")({
  head: () => ({
    meta: [{ title: "Acompanhe sua Ordem de Serviço" }],
  }),
  component: TrackPage,
});

type OS = {
  id: string;
  os_number: number | null;
  equipment: string;
  brand: string | null;
  model: string | null;
  imei: string | null;
  problem_description: string | null;
  diagnosis: string | null;
  solution: string | null;
  status: string;
  priority: string | null;
  estimated_cost: number | null;
  total_cost: number | null;
  warranty_days: number | null;
  due_date: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_TIMELINE = [
  { key: "recebida", label: "Recebida", icon: Package },
  { key: "em_diagnostico", label: "Em diagnóstico", icon: AlertCircle },
  { key: "aguardando_pecas", label: "Aguardando peças", icon: Clock },
  { key: "em_reparo", label: "Em reparo", icon: Wrench },
  { key: "concluida", label: "Pronta para retirar", icon: CheckCircle2 },
  { key: "entregue", label: "Entregue", icon: CheckCircle2 },
];

function statusIndex(status: string): number {
  const idx = STATUS_TIMELINE.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function TrackPage() {
  const { id } = Route.useParams();
  const [os, setOs] = useState<OS | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/os-public/${encodeURIComponent(id)}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Ordem de serviço não encontrada" : "Erro ao carregar");
          setLoading(false);
          return;
        }
        const json = await res.json();
        setOs(json.os as OS);
        setOrgName(json.org_name ?? "Assistência Técnica");
      } catch {
        setError("Erro de conexão");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Wrench className="h-10 w-10 text-primary animate-pulse mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error || !os) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2">Não encontramos sua OS</h1>
          <p className="text-sm text-muted-foreground">
            Confira o link recebido ou entre em contato com a loja.
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = statusIndex(os.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest font-black text-primary">{orgName}</p>
          <h1 className="text-2xl font-black mt-1">
            Ordem de Serviço {os.os_number ? `#${os.os_number}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aberta em {new Date(os.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-4">
            <Smartphone className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-black">{os.equipment}</h2>
              {(os.brand || os.model) && (
                <p className="text-xs text-muted-foreground">
                  {[os.brand, os.model].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
          {os.problem_description && (
            <div className="text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Problema relatado:</span>{" "}
              {os.problem_description}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-black text-sm uppercase tracking-widest mb-4">Acompanhamento</h3>
          <ol className="space-y-3">
            {STATUS_TIMELINE.map((step, i) => {
              const done = i <= currentIdx;
              const current = i === currentIdx;
              return (
                <li key={step.key} className="flex items-start gap-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      done
                        ? current
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-success/20 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <step.icon className="h-4 w-4" />
                  </div>
                  <div className="pt-1.5">
                    <p
                      className={`text-sm ${
                        current
                          ? "font-black text-primary"
                          : done
                            ? "font-bold"
                            : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {(os.diagnosis || os.solution) && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            {os.diagnosis && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">
                  Diagnóstico
                </p>
                <p className="text-sm">{os.diagnosis}</p>
              </div>
            )}
            {os.solution && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1">
                  Solução
                </p>
                <p className="text-sm">{os.solution}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {os.estimated_cost != null && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                Orçamento
              </p>
              <p className="text-xl font-black">R$ {Number(os.estimated_cost).toFixed(2)}</p>
            </div>
          )}
          {os.total_cost != null && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                Total
              </p>
              <p className="text-xl font-black text-primary">
                R$ {Number(os.total_cost).toFixed(2)}
              </p>
            </div>
          )}
          {os.due_date && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Previsão
              </p>
              <p className="text-sm font-bold mt-1">
                {new Date(os.due_date).toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}
          {os.warranty_days != null && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                Garantia
              </p>
              <p className="text-sm font-bold mt-1">{os.warranty_days} dias</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Dúvidas? Entre em contato com a loja.
        </p>
      </div>
    </div>
  );
}
