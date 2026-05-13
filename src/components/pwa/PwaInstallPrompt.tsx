import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<unknown>;
};

export function PwaInstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isPreviewHost = window.location.hostname.includes("lovableproject.com");

    if (isPreviewHost) {
      navigator.serviceWorker
        ?.getRegistrations?.()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        })
        .catch(() => {});
      return;
    }

    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if (localStorage.getItem("pwa_install_dismissed")) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show || !evt) return null;

  const install = async () => {
    evt.prompt();
    await evt.userChoice;
    setShow(false);
    setEvt(null);
  };
  const dismiss = () => {
    localStorage.setItem("pwa_install_dismissed", "1");
    setShow(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-4 animate-in slide-in-from-bottom-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-bold text-sm">Instalar ConectaCRM</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Acesse rápido como um app no seu celular ou desktop
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={install}>
              Instalar
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        </div>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
