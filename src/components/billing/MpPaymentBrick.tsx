import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Public key (publishable, ok no frontend)
const MP_PUBLIC_KEY = "APP_USR-c09d032c-d0b8-424a-ae0e-5054cf8fd581";

declare global {
  interface Window {
    MercadoPago?: any;
    paymentBrickController?: any;
  }
}

type Props = {
  planSlug: string;
  amount: number; // em reais
  payerEmail?: string;
  onSuccess?: (status: string) => void;
};

type Result = {
  status: string;
  qr_code?: string;
  qr_code_base64?: string;
  ticket_url?: string;
  boleto_url?: string;
};

export function MpPaymentBrick({ planSlug, amount, payerEmail, onSuccess }: Props) {
  const containerId = "mp-payment-brick-container";
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    let cancelled = false;
    const tryInit = async () => {
      // Espera o SDK
      for (let i = 0; i < 50; i++) {
        if (window.MercadoPago) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled || !window.MercadoPago) {
        toast.error("Não foi possível carregar o Mercado Pago.");
        return;
      }

      const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });
      const bricks = mp.bricks();

      try {
        if (window.paymentBrickController?.unmount) {
          await window.paymentBrickController.unmount();
        }
      } catch {}

      window.paymentBrickController = await bricks.create("payment", containerId, {
        initialization: {
          amount,
          payer: { email: payerEmail || "" },
        },
        customization: {
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
            bankTransfer: "all", // PIX
            ticket: "all",       // Boleto
          },
          visual: { style: { theme: "default" } },
        },
        callbacks: {
          onReady: () => setReady(true),
          onError: (err: any) => {
            console.error("Brick error", err);
            toast.error(err?.message || "Erro no formulário de pagamento");
          },
          onSubmit: async ({ formData }: any) => {
            setSubmitting(true);
            try {
              const { data: session } = await supabase.auth.getSession();
              if (!session.session) {
                toast.error("Faça login para pagar.");
                throw new Error("not authenticated");
              }
              const { data, error } = await supabase.functions.invoke("mp-process-payment", {
                body: { plan_slug: planSlug, formData },
                headers: { "x-idempotency-key": crypto.randomUUID() },
              });
              if (error) throw error;
              const r = data as Result;
              setResult(r);
              if (r.status === "approved") {
                toast.success("Pagamento aprovado!");
                onSuccess?.(r.status);
              } else if (r.status === "in_process" || r.status === "pending") {
                toast("Pagamento pendente — aguarde a confirmação.");
              } else {
                toast.error(`Pagamento ${r.status}`);
              }
            } catch (e: any) {
              toast.error(e?.message || "Erro ao processar pagamento");
              throw e;
            } finally {
              setSubmitting(false);
            }
          },
        },
      });
      initialized.current = true;
    };

    tryInit();

    return () => {
      cancelled = true;
      try {
        window.paymentBrickController?.unmount?.();
      } catch {}
      initialized.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSlug, amount]);

  if (result?.status === "approved") {
    return (
      <div className="flex flex-col items-center text-center py-10">
        <CheckCircle2 className="h-14 w-14 text-primary" />
        <h3 className="text-xl font-semibold mt-4">Pagamento aprovado!</h3>
        <p className="text-sm text-muted-foreground mt-1">Sua assinatura está ativa.</p>
      </div>
    );
  }

  if (result?.qr_code) {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <h3 className="text-lg font-semibold">Pague com PIX</h3>
        {result.qr_code_base64 && (
          <img
            src={`data:image/png;base64,${result.qr_code_base64}`}
            alt="QR Code PIX"
            className="w-64 h-64 mt-4 border rounded"
          />
        )}
        <div className="mt-4 w-full">
          <p className="text-xs text-muted-foreground mb-2">Ou copie o código:</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={result.qr_code}
              className="flex-1 px-3 py-2 text-xs border rounded bg-muted font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(result.qr_code!);
                toast.success("Código copiado!");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (result?.boleto_url) {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <h3 className="text-lg font-semibold">Boleto gerado</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Conclua o pagamento usando o boleto abaixo:
        </p>
        <Button asChild className="mt-4">
          <a href={result.boleto_url} target="_blank" rel="noreferrer">Abrir boleto</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {!ready && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div id={containerId} />
      {submitting && (
        <div className="absolute inset-0 bg-background/70 flex items-center justify-center rounded">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
