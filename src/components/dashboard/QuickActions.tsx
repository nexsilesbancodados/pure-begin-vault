import { MessageSquare, Instagram, ShoppingBag, Smartphone, UserPlus, FileText } from "lucide-react";
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
            className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-card hover:shadow-elegant hover:-translate-y-0.5 transition-all group">
            <div className={`h-10 w-10 rounded-xl ${action.color} text-white grid place-items-center shrink-0 shadow-sm`}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-[13px] font-bold text-foreground/90 group-hover:text-primary transition">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
