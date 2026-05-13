import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, QrCode, Percent, ShieldCheck, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getPixConfig, setPixConfig } from "@/components/vendas/PixCharge";
import {
  getManagerPin,
  setManagerPin,
  getAutoApproveLimit,
  setAutoApproveLimit,
} from "@/components/vendas/DiscountApproval";

export const Route = createFileRoute("/configuracoes/loja")({
  component: ConfigLojaPage,
});

function ConfigLojaPage() {
  const pix = getPixConfig() ?? { pixKey: "", merchantName: "", merchantCity: "" };
  const [pixKey, setPixKey] = useState(pix.pixKey);
  const [merchantName, setMerchantName] = useState(pix.merchantName);
  const [merchantCity, setMerchantCity] = useState(pix.merchantCity);
  const [pin, setPin] = useState(getManagerPin());
  const [pinConfirm, setPinConfirm] = useState(getManagerPin());
  const [autoLimit, setAutoLimit] = useState(getAutoApproveLimit());
  const [commissionPct, setCommissionPct] = useState(() => {
    const v = parseFloat(localStorage.getItem("conectaphone:comissao-percent") ?? "3");
    return isNaN(v) ? 3 : v;
  });

  const savePix = () => {
    if (!pixKey.trim() || !merchantName.trim() || !merchantCity.trim()) {
      toast.error("Preencha todos os campos do Pix");
      return;
    }
    setPixConfig({
      pixKey: pixKey.trim(),
      merchantName: merchantName.trim(),
      merchantCity: merchantCity.trim(),
    });
    toast.success("Pix salvo");
  };

  const savePin = () => {
    if (pin.length < 4) {
      toast.error("PIN precisa ter pelo menos 4 dígitos");
      return;
    }
    if (pin !== pinConfirm) {
      toast.error("PINs não coincidem");
      return;
    }
    setManagerPin(pin);
    setAutoApproveLimit(autoLimit);
    toast.success("PIN gerente salvo");
  };

  const saveCommission = () => {
    if (commissionPct < 0 || commissionPct > 100) {
      toast.error("Comissão deve ser entre 0 e 100%");
      return;
    }
    localStorage.setItem("conectaphone:comissao-percent", String(commissionPct));
    toast.success("Comissão padrão salva");
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Configurações da Loja" subtitle="Pix, comissões e segurança" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto w-full">
          {/* Pix */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <QrCode className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-black">Pix da loja</h2>
                <p className="text-xs text-muted-foreground">
                  QR copia-e-cola será gerado automaticamente no PDV
                </p>
              </div>
              {pix.pixKey && <CheckCircle2 className="h-5 w-5 text-success ml-auto" />}
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="pix">Chave Pix</Label>
                <Input
                  id="pix"
                  placeholder="CPF / CNPJ / email / telefone / aleatória"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pixname">Nome (até 25 caracteres)</Label>
                  <Input
                    id="pixname"
                    maxLength={25}
                    placeholder="CONECTAPHONE LOJA"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="pixcity">Cidade (até 15 caracteres)</Label>
                  <Input
                    id="pixcity"
                    maxLength={15}
                    placeholder="SAO PAULO"
                    value={merchantCity}
                    onChange={(e) => setMerchantCity(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={savePix} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" /> Salvar Pix
              </Button>
            </div>
          </Card>

          {/* PIN Gerente */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-black">PIN do gerente</h2>
                <p className="text-xs text-muted-foreground">
                  Autoriza descontos acima do limite no PDV
                </p>
              </div>
              {getManagerPin() && <CheckCircle2 className="h-5 w-5 text-success ml-auto" />}
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pin1">PIN (4–6 dígitos)</Label>
                  <Input
                    id="pin1"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="****"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div>
                  <Label htmlFor="pin2">Confirmar</Label>
                  <Input
                    id="pin2"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="****"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="lim">Limite auto-aprovação (% de desconto)</Label>
                <Input
                  id="lim"
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={autoLimit}
                  onChange={(e) => setAutoLimit(parseFloat(e.target.value) || 0)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Descontos até esse percentual não pedem PIN. Acima, exige autorização.
                </p>
              </div>
              <Button onClick={savePin} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" /> Salvar segurança
              </Button>
            </div>
          </Card>

          {/* Comissão */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-xl bg-success/10 text-success flex items-center justify-center">
                <Percent className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-black">Comissão padrão</h2>
                <p className="text-xs text-muted-foreground">
                  % aplicado no ranking de comissões (/relatorios/comissoes)
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="com">% Comissão sobre venda</Label>
                <Input
                  id="com"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={commissionPct}
                  onChange={(e) => setCommissionPct(parseFloat(e.target.value) || 0)}
                />
              </div>
              <Button onClick={saveCommission} className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" /> Salvar comissão
              </Button>
            </div>
          </Card>

          <Card className="p-4 bg-muted/40 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Essas configurações ficam armazenadas no navegador (localStorage) — cada dispositivo
                precisa configurar uma vez. Para sincronização entre máquinas, migraremos para a
                tabela <code>organization_settings</code> em versão futura.
              </p>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
