import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

const LS_KEY = "conectaphone:cookies-accepted";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(LS_KEY);
    if (!v) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ accepted: true, at: new Date().toISOString() }));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 sm:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4 text-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Cookie className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-black mb-1">Cookies & dados</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Usamos cookies essenciais pra autenticação e preferências, e dados anonimizados de uso
              pra melhorar o serviço. Leia nossa{" "}
              <Link to="/privacidade" className="text-primary font-bold hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={accept}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition"
          >
            Entendi e aceito
          </button>
        </div>
      </div>
    </div>
  );
}
