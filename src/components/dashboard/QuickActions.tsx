import {
  MessageSquare,
  Instagram,
  ShoppingBag,
  Smartphone,
  UserPlus,
  FileText,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: "Novo Lead", icon: UserPlus, color: "bg-primary", url: "/leads" },
    { label: "Enviar Catálogo", icon: Smartphone, color: "bg-success", url: "/produtos" },
    { label: "Gerar Proposta", icon: FileText, color: "bg-info", url: "/vendas/orcamentos" },
    { label: "Atendimento WA", icon: MessageSquare, color: "bg-success", url: "/atendimento" },
    { label: "Direct IG", icon: Instagram, color: "bg-pink-500", url: "/atendimento" },
    { label: "Nova Venda", icon: ShoppingBag, color: "bg-primary", url: "/pdv" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-6 gap-3 mb-6">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => navigate({ to: action.url as any })}
            aria-label={action.label}
            className="group relative overflow-hidden flex items-center gap-3 p-3 rounded-2xl bg-card/60 backdrop-blur-md border border-border/50 shadow-card hover:shadow-elegant hover:-translate-y-0.5 hover:border-primary/40 active:scale-[0.98] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* Top highlight */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
            />
            {/* Shine sweep */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
            />
            <div
              aria-hidden
              className={`h-10 w-10 rounded-xl ${action.color} text-white grid place-items-center shrink-0 shadow-sm ring-1 ring-inset ring-white/15 transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-4deg] group-hover:shadow-md`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className="relative text-[13px] font-bold text-foreground/90 group-hover:text-primary transition-colors">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
