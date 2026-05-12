import { useEffect, useMemo, useState } from "react";
import { Copy, Check, QrCode, AlertCircle, Settings } from "lucide-react";
import { buildPixPayload, pixQrUrl } from "@/lib/pix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface PixChargeProps {
  amount: number;
  txId?: string;
  description?: string;
  /** Se o vendedor não tiver Pix configurado, mostra o setup. */
  fallbackToSetup?: boolean;
}

type PixConfig = {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
};

const LS_KEY = "conectaphone:pix-config";

export function getPixConfig(): PixConfig | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PixConfig;
    if (!parsed.pixKey || !parsed.merchantName || !parsed.merchantCity) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setPixConfig(c: PixConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(c));
}

export function PixCharge({ amount, txId, description, fallbackToSetup = true }: PixChargeProps) {
  const [cfg, setCfg] = useState<PixConfig | null>(getPixConfig());
  const [showSetup, setShowSetup] = useState(!cfg);
  const [copied, setCopied] = useState(false);

  const payload = useMemo(() => {
    if (!cfg) return null;
    return buildPixPayload({
      pixKey: cfg.pixKey,
      merchantName: cfg.merchantName,
      merchantCity: cfg.merchantCity,
      amount,
      txId: txId?.slice(0, 25),
      description,
    });
  }, [cfg, amount, txId, description]);

  const handleCopy = async () => {
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    setCopied(true);
    toast.success("Código Pix copiado");
    setTimeout(() => setCopied(false), 2500);
  };

  if (showSetup || !cfg) {
    if (!fallbackToSetup && !cfg) {
      return (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-bold">Pix não configurado</p>
          <p className="text-muted-foreground text-xs mt-1">
            Configure sua chave Pix em Configurações.
          </p>
        </div>
      );
    }
    return <PixSetup initial={cfg} onSaved={(c) => { setCfg(c); setShowSetup(false); }} onCancel={() => setShowSetup(false)} />;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-black text-sm">Pix instantâneo</h3>
            <p className="text-xs text-muted-foreground">
              R$ {amount.toFixed(2)} · {cfg.merchantName}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSetup(true)}
          className="text-muted-foreground hover:text-primary p-1"
          title="Editar config Pix"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="bg-white p-3 rounded-xl border border-border">
          <img
            src={pixQrUrl(payload!, 200)}
            alt="QR Code Pix"
            className="h-48 w-48"
          />
        </div>
        <div className="flex-1 w-full space-y-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            Pix copia-e-cola
          </p>
          <textarea
            readOnly
            value={payload!}
            className="w-full h-24 text-[10px] font-mono bg-muted/40 border border-border rounded-lg p-2 break-all resize-none"
          />
          <Button onClick={handleCopy} className="w-full">
            {copied ? (
              <><Check className="h-4 w-4 mr-2" /> Copiado</>
            ) : (
              <><Copy className="h-4 w-4 mr-2" /> Copiar código</>
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
        Pagamento cai direto na sua conta. O cliente abre WhatsApp ou app do banco e cola/escaneia.
      </div>
    </div>
  );
}

function PixSetup({
  initial,
  onSaved,
  onCancel,
}: {
  initial: PixConfig | null;
  onSaved: (c: PixConfig) => void;
  onCancel: () => void;
}) {
  const [pixKey, setPixKey] = useState(initial?.pixKey ?? "");
  const [merchantName, setMerchantName] = useState(initial?.merchantName ?? "");
  const [merchantCity, setMerchantCity] = useState(initial?.merchantCity ?? "");

  const save = () => {
    if (!pixKey.trim() || !merchantName.trim() || !merchantCity.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    const cfg = {
      pixKey: pixKey.trim(),
      merchantName: merchantName.trim(),
      merchantCity: merchantCity.trim(),
    };
    setPixConfig(cfg);
    onSaved(cfg);
    toast.success("Pix configurado");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-black text-sm flex items-center gap-2">
        <Settings className="h-4 w-4" /> Configurar Pix
      </h3>
      <div>
        <Label htmlFor="pix-key">Chave Pix</Label>
        <Input
          id="pix-key"
          placeholder="CPF / CNPJ / email / telefone / aleatória"
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="pix-name">Nome (até 25 caracteres)</Label>
        <Input
          id="pix-name"
          placeholder="Ex: CONECTAPHONE LOJA"
          maxLength={25}
          value={merchantName}
          onChange={(e) => setMerchantName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="pix-city">Cidade (até 15 caracteres)</Label>
        <Input
          id="pix-city"
          placeholder="Ex: SAO PAULO"
          maxLength={15}
          value={merchantCity}
          onChange={(e) => setMerchantCity(e.target.value)}
        />
      </div>
      <div className="flex gap-2 pt-2">
        {initial && (
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
        )}
        <Button onClick={save} className="flex-1">
          Salvar
        </Button>
      </div>
    </div>
  );
}
