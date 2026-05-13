import { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

const SECTIONS = [
  {
    title: "Global",
    items: [
      ["⌘ K  /  Ctrl K", "Abrir busca rápida"],
      ["?", "Mostrar este painel"],
      ["Esc", "Fechar diálogo / busca"],
    ],
  },
  {
    title: "PDV (Frente de Caixa)",
    items: [
      ["F1", "Foco no código de barras"],
      ["F2", "Foco na busca de produtos"],
      ["F4", "Foco no vendedor"],
      ["F8", "Abrir checkout"],
      ["F9", "Vincular cliente"],
      ["F10", "Finalizar venda"],
    ],
  },
  {
    title: "Listagens",
    items: [
      ["/", "Foco no campo de busca"],
      ["N", "Novo registro (em listas)"],
      ["Enter", "Abrir item selecionado"],
    ],
  },
];

export function KeyboardHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <h2 className="font-black">Atalhos de teclado</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="text-[11px] uppercase font-black tracking-widest text-muted-foreground mb-2">
                {s.title}
              </h3>
              <div className="space-y-1">
                {s.items.map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-muted/40"
                  >
                    <span className="text-sm">{label}</span>
                    <kbd className="text-[11px] font-mono px-2 py-1 rounded border border-border bg-muted/40">
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          Aperte <kbd className="px-1 rounded bg-muted">?</kbd> a qualquer momento pra ver os
          atalhos.
        </div>
      </div>
    </div>
  );
}
