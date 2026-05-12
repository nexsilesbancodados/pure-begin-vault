import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Bluetooth, Usb, ScanLine, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import {
  hardwareSupport,
  connectUsbPrinter,
  printReceipt,
  listenKeyboardScanner,
  connectBluetoothScanner,
  UsbPrinter,
} from "@/lib/hardware";
import { toast } from "sonner";

export const Route = createFileRoute("/hardware")({
  head: () => ({ meta: [{ title: "Hardware · ConectaCRM" }] }),
  component: HardwarePage,
});

function HardwarePage() {
  const [printer, setPrinter] = useState<UsbPrinter | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const [scannerCleanup, setScannerCleanup] = useState<(() => void) | null>(null);

  const handleConnectPrinter = async () => {
    try {
      const p = await connectUsbPrinter();
      setPrinter(p);
      toast.success("Impressora conectada");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const handleTestPrint = async () => {
    if (!printer) return;
    try {
      await printReceipt(printer, [
        { text: "ConectaCRM", align: "center", bold: true, size: 2 },
        { text: "------------------------", align: "center" },
        { text: "TESTE DE IMPRESSAO", align: "center", bold: true },
        { text: " " },
        { text: "Data: " + new Date().toLocaleString("pt-BR") },
        { text: " " },
        { text: "Se voce esta lendo isso," },
        { text: "sua impressora esta OK." },
      ]);
      toast.success("Cupom enviado");
    } catch (e: any) {
      toast.error("Falha: " + e.message);
    }
  };

  const handleToggleScanner = () => {
    if (scannerActive) {
      scannerCleanup?.();
      setScannerCleanup(null);
      setScannerActive(false);
      toast.info("Scanner desativado");
      return;
    }
    const cleanup = listenKeyboardScanner((code) => {
      setLastScan(code);
      toast.success("Código lido: " + code);
    });
    setScannerCleanup(() => cleanup);
    setScannerActive(true);
    toast.success("Scanner pronto — aponte e leia");
  };

  const handleBleScanner = async () => {
    try {
      await connectBluetoothScanner((code) => {
        setLastScan(code);
        toast.success("BLE: " + code);
      });
      toast.success("Bluetooth conectado");
    } catch (e: any) {
      toast.error("Erro BLE: " + e.message);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Hardware" subtitle="Impressora térmica, leitor de código, gaveta" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl">

          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-4">Suporte do navegador</h3>
            <div className="grid grid-cols-3 gap-3">
              <SupportBadge icon={Usb} label="WebUSB" ok={hardwareSupport.webusb} />
              <SupportBadge icon={Bluetooth} label="Web Bluetooth" ok={hardwareSupport.bluetooth} />
              <SupportBadge icon={ScanLine} label="WebHID" ok={hardwareSupport.hid} />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Requer Chrome/Edge em HTTPS. Não funciona em Firefox/Safari ou via HTTP.
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Printer className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-base">Impressora térmica USB</h3>
                <p className="text-xs text-muted-foreground">Epson, Bematech, Daruma, Elgin (58mm ou 80mm) via ESC/POS</p>
              </div>
              {printer ? (
                <span className="text-xs font-bold text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Conectada
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConnectPrinter} disabled={!hardwareSupport.webusb}>
                {printer ? "Trocar impressora" : "Conectar"}
              </Button>
              <Button variant="outline" onClick={handleTestPrint} disabled={!printer}>
                Imprimir cupom de teste
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center">
                <ScanLine className="h-5 w-5 text-info" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-base">Leitor de código de barras</h3>
                <p className="text-xs text-muted-foreground">USB/Bluetooth modo HID-keyboard (auto-detecta)</p>
              </div>
              {scannerActive ? (
                <span className="text-xs font-bold text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                </span>
              ) : null}
            </div>
            <div className="flex gap-2 mb-3">
              <Button onClick={handleToggleScanner}>
                {scannerActive ? "Desativar" : "Ativar scanner HID"}
              </Button>
              <Button variant="outline" onClick={handleBleScanner} disabled={!hardwareSupport.bluetooth}>
                <Bluetooth className="h-4 w-4 mr-2" /> Conectar BLE
              </Button>
            </div>
            {lastScan && (
              <div className="p-3 rounded-xl bg-success/10 border border-success/30">
                <p className="text-xs text-muted-foreground mb-1">Último código lido:</p>
                <p className="font-mono text-lg font-bold">{lastScan}</p>
              </div>
            )}
          </Card>

          <Card className="p-5 bg-warning/5 border-warning/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold mb-1">Dica de instalação</p>
                <p className="text-muted-foreground">
                  Use <strong>Chrome 89+ ou Edge 89+</strong>. No Linux, dê acesso ao dispositivo:<br/>
                  <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">sudo usermod -a -G dialout $USER</code>
                </p>
              </div>
            </div>
          </Card>

        </main>
      </div>
    </div>
  );
}

function SupportBadge({ icon: Icon, label, ok }: { icon: any; label: string; ok: boolean }) {
  return (
    <div className={`p-3 rounded-xl border ${ok ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${ok ? "text-success" : "text-destructive"}`} />
        <span className="text-xs font-bold">{label}</span>
        {ok ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-success ml-auto" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-destructive ml-auto" />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">{ok ? "Disponível" : "Não suportado"}</p>
    </div>
  );
}
