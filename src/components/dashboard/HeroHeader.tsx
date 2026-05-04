import { Sparkles, TrendingUp, Calendar, ArrowUpRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface HeroHeaderProps {
  userName: string;
  todaySales: number;
  monthRevenue: number;
  newLeads: number;
}

export function HeroHeader({ userName, todaySales, monthRevenue, newLeads }: HeroHeaderProps) {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

  return (
    <div className="relative overflow-hidden rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 mb-6 animate-fade-in bg-gradient-primary shadow-elegant">
      {/* Decorative blurred orbs */}
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
        style={{ background: "oklch(0.85 0.2 330)" }} />
      <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "oklch(0.85 0.18 200)" }} />
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5 lg:gap-6">
        <div className="text-white min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[11px] font-medium mb-3">
            <Calendar className="h-3 w-3" />
            <span className="capitalize">{today}</span>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold font-display tracking-tight break-words">
            Olá, {userName}! <span className="inline-block animate-fade-in">👋</span>
          </h1>
          <p className="text-white/80 text-xs sm:text-sm mt-1.5 max-w-xl">
            Aqui está o resumo do seu negócio em tempo real. Tudo o que importa, num só lugar.
          </p>

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={() => navigate({ to: "/pdv" })}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-white text-foreground text-[12px] sm:text-[13px] font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              <Sparkles className="h-4 w-4 text-primary" />
              Nova Venda
            </button>
            <button
              onClick={() => navigate({ to: "/relatorios" as any })}
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 text-white text-[12px] sm:text-[13px] font-semibold hover:bg-white/25 transition"
            >
              <TrendingUp className="h-4 w-4" />
              Relatórios
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full lg:w-auto lg:min-w-[420px]">
          <Stat label="Vendas hoje" value={fmt(todaySales)} accent="oklch(0.85 0.18 158)" />
          <Stat label="Mês" value={fmt(monthRevenue)} accent="oklch(0.85 0.18 75)" />
          <Stat label="Novos leads" value={String(newLeads)} accent="oklch(0.85 0.2 330)" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2.5 sm:p-3 hover:bg-white/15 transition min-w-0">
      <div className="text-[10px] sm:text-[10.5px] text-white/70 font-medium uppercase tracking-wide truncate">{label}</div>
      <div className="text-white font-bold font-display text-sm sm:text-lg md:text-xl mt-1 truncate" style={{ textShadow: "0 1px 8px oklch(0 0 0 / 0.2)" }}>
        {value}
      </div>
      <div className="h-1 mt-2 rounded-full" style={{ background: accent, opacity: 0.7 }} />
    </div>
  );
}