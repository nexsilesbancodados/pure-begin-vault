import { Sparkles, TrendingUp, Calendar, ArrowUpRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface HeroHeaderProps {
  userName: string;
  /** Optional: short status sentence shown under the greeting */
  status?: string;
}

export function HeroHeader({ userName, status }: HeroHeaderProps) {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="relative overflow-hidden rounded-2xl md:rounded-3xl p-5 sm:p-6 md:p-7 mb-6 animate-fade-in bg-gradient-primary shadow-elegant">
      {/* Decorative blurred orbs */}
      <div
        className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: "oklch(0.85 0.2 330)" }}
      />
      <div
        className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "oklch(0.85 0.18 200)" }}
      />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-white min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[11px] font-medium mb-3">
            <Calendar className="h-3 w-3" />
            <span className="capitalize">{today}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-[32px] font-bold font-display tracking-tight break-words leading-tight">
            Olá, {userName}! <span className="inline-block animate-fade-in">👋</span>
          </h1>
          <p className="text-white/80 text-sm mt-1.5 max-w-xl">
            {status ?? "Aqui está o resumo do seu negócio em tempo real."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => navigate({ to: "/pdv" })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-foreground text-sm font-semibold hover:scale-[1.03] transition-transform shadow-lg"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Nova Venda
          </button>
          <button
            onClick={() => navigate({ to: "/relatorios" as any })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 text-white text-sm font-semibold hover:bg-white/25 transition"
          >
            <TrendingUp className="h-4 w-4" />
            Relatórios
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
