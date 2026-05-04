import { useState, useEffect, useRef } from "react";
import { evolution } from "@/lib/evolution";
import {
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  QrCode as QrCodeIcon,
  Wifi,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

 interface QrCodeModalProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   initialInstanceName?: string;
 }
 
 const QR_LIFETIME = 40;
 
 export function QrCodeModal({ open, onOpenChange, initialInstanceName }: QrCodeModalProps) {
   const [instanceName, setInstanceName] = useState(initialInstanceName || "");
   const [step, setStep] = useState(initialInstanceName ? "qr" : "name");
 
   useEffect(() => {
     if (initialInstanceName) {
       setInstanceName(initialInstanceName);
       setStep("qr");
     }
   }, [initialInstanceName]);
 
   const onClose = () => onOpenChange(false);
   const onSuccess = () => onOpenChange(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [countdown, setCountdown] = useState<number>(QR_LIFETIME);
  const [copied, setCopied] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  const setupAndFetchQrCode = async () => {
    try {
      setLoading(true);
      setError(null);
      setPairingCode(null);

      const data = await evolution.getQrCode(instanceName);
      console.log("QR Code Data Received:", data);

      // Evolution API retorna { status: 404, response: { message: ["..."] } } se a instância não existir
      if ((data as any)?.status && (data as any)?.status >= 400) {
        const apiMsg =
          (data as any)?.response?.message?.[0] ||
          (data as any)?.message ||
          `Erro ${(data as any).status}`;
        setError(String(apiMsg));
        return;
      }

      const base64 =
        (data as any)?.base64 ||
        (data as any)?.qrcode?.base64 ||
        (data as any)?.qrcode ||
        (typeof data === "string" ? data : null);
      const code = (data as any)?.code || (data as any)?.qrcode?.code;
      const pCode = (data as any)?.pairingCode || (data as any)?.qrcode?.pairingCode;
      if (pCode) setPairingCode(pCode);

      if (base64) {
        const src = String(base64).startsWith("data:")
          ? String(base64)
          : `data:image/png;base64,${base64}`;
        setQrCode(src);
        setCountdown(QR_LIFETIME);
      } else if (code && typeof code === "string") {
        setQrCode(
          `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(code)}`,
        );
        setCountdown(QR_LIFETIME);
      } else if ((data as any)?.instance?.state === "open" || (data as any)?.state === "open") {
        setStatus("open");
        onSuccess();
      } else {
        setError("Não foi possível gerar o QR Code. Tente novamente.");
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao buscar QR Code. Verifique a conexão com a Evolution API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setupAndFetchQrCode();

    const refreshInterval = setInterval(() => {
      if (statusRef.current !== "open") setupAndFetchQrCode();
    }, QR_LIFETIME * 1000);

    const tickInterval = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);

    const statusInterval = setInterval(async () => {
      try {
        const state = await evolution.getInstanceConnection(instanceName);
        const currentState = (state as any).instance?.state || (state as any).state;
        if (currentState === "open") {
          setStatus("open");
          clearInterval(statusInterval);
          clearInterval(refreshInterval);
          clearInterval(tickInterval);
          toast.success("WhatsApp conectado com sucesso!");
          setTimeout(onSuccess, 2000);
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(refreshInterval);
      clearInterval(tickInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceName]);

  const handleCopyPairing = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const progress = Math.max(0, (countdown / QR_LIFETIME) * 100);

  const steps = [
    { icon: Smartphone, title: "Abra o WhatsApp", desc: "No seu celular, toque em Menu (⋮) ou Configurações." },
    { icon: Wifi, title: "Dispositivos conectados", desc: 'Toque em "Dispositivos conectados" → "Conectar um dispositivo".' },
    { icon: QrCodeIcon, title: "Aponte para o QR", desc: "Aponte a câmera do celular para o código ao lado." },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-7 py-5 border-b border-border bg-gradient-to-r from-card to-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
              <QrCodeIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg leading-tight">Conectar WhatsApp</h3>
              <p className="text-[11px] font-bold text-muted-foreground tracking-wide">
                Instância: <span className="text-foreground">{instanceName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
              <span className={`h-2 w-2 rounded-full ${status === "open" ? "bg-success" : "bg-warning animate-pulse"}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {status === "open" ? "Online" : "Aguardando"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full hover:bg-muted grid place-items-center transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-5">
          {/* Instruções */}
          <div className="md:col-span-2 p-8 bg-gradient-to-br from-muted/30 to-transparent border-b md:border-b-0 md:border-r border-border">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-4">
              Como conectar
            </p>
            <h4 className="text-xl font-black leading-tight mb-6">
              Vincule seu WhatsApp em <span className="text-primary">3 passos</span>
            </h4>

            <div className="space-y-5">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center text-primary group-hover:scale-110 group-hover:border-primary/40 transition-all">
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-bold leading-tight">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center gap-2 px-4 py-3 rounded-2xl bg-success/5 border border-success/20">
              <ShieldCheck className="h-4 w-4 text-success shrink-0" />
              <p className="text-[11px] font-medium text-muted-foreground leading-snug">
                Conexão criptografada via Evolution API. Suas mensagens permanecem privadas.
              </p>
            </div>
          </div>

          {/* QR Code */}
          <div className="md:col-span-3 p-8 flex flex-col items-center justify-center min-h-[460px]">
            {loading ? (
              <div className="flex flex-col items-center space-y-5">
                <div className="relative">
                  <div className="h-36 w-36 rounded-3xl border-4 border-primary/15 border-t-primary animate-spin" />
                  <QrCodeIcon className="absolute inset-0 m-auto h-10 w-10 text-primary/40" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-primary animate-pulse">
                  Preparando QR Code...
                </p>
              </div>
            ) : error ? (
              <div className="text-center space-y-5 max-w-xs">
                <div className="h-20 w-20 bg-destructive/10 rounded-3xl flex items-center justify-center mx-auto">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <div>
                  <p className="text-base font-black mb-1">Algo deu errado</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={setupAndFetchQrCode}
                  className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/30 hover:scale-[1.03] transition-all flex items-center gap-2 mx-auto"
                >
                  <RefreshCw className="h-4 w-4" /> Tentar novamente
                </button>
              </div>
            ) : status === "open" ? (
              <div className="text-center space-y-4 animate-in zoom-in-90">
                <div className="relative mx-auto h-24 w-24">
                  <div className="absolute inset-0 rounded-full bg-success/20 animate-ping" />
                  <div className="relative h-24 w-24 bg-success/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-14 w-14 text-success" />
                  </div>
                </div>
                <h4 className="text-2xl font-black">Conectado!</h4>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Seu WhatsApp está vinculado e pronto para enviar e receber mensagens.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-5 w-full animate-in fade-in slide-in-from-bottom-4">
                <div className="relative">
                  <div className="absolute -inset-1.5 bg-gradient-to-r from-primary via-primary to-primary rounded-[2rem] blur opacity-40 animate-pulse" />
                  <div className="relative bg-white p-5 rounded-[1.75rem] shadow-2xl">
                    {qrCode ? (
                      <img src={qrCode} alt="WhatsApp QR Code" className="h-60 w-60 lg:h-64 lg:w-64" />
                    ) : (
                      <div className="h-60 w-60 flex items-center justify-center bg-muted/50 rounded-xl">
                        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 h-5 w-5 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                    <div className="absolute top-2 right-2 h-5 w-5 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                    <div className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                    <div className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-primary rounded-br-lg" />
                  </div>
                </div>

                <div className="w-full max-w-xs space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-muted-foreground">Expira em</span>
                    <span className={countdown <= 10 ? "text-destructive" : "text-primary"}>
                      {countdown}s
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        countdown <= 10 ? "bg-destructive" : "bg-primary"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {pairingCode && (
                  <div className="w-full max-w-xs">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground text-center mb-2">
                      Ou use o código de pareamento
                    </p>
                    <button
                      onClick={handleCopyPairing}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-muted/60 hover:bg-muted border border-border transition group"
                    >
                      <span className="font-mono font-black text-lg tracking-[0.3em] text-foreground">
                        {pairingCode}
                      </span>
                      {copied ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                      )}
                    </button>
                  </div>
                )}

                <button
                  onClick={setupAndFetchQrCode}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> Gerar novo código
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-7 py-4 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            Polling de status a cada 3s · Atualização automática
          </p>
          <button
            onClick={onClose}
            className="h-10 px-6 rounded-xl border border-border hover:bg-muted text-sm font-semibold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
