import { Sparkles, TrendingUp, Calendar, ArrowUpRight, Store } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useUserOrgs } from "@/lib/useUserOrgs";

interface HeroHeaderProps {
  userName: string;
  /** Optional: short status sentence shown under the greeting */
  status?: string;
}

export function HeroHeader({ userName, status }: HeroHeaderProps) {
  const navigate = useNavigate();
  const { orgs, activeOrgId } = useUserOrgs();
  const activeOrg = orgs.find((o) => o.organization_id === activeOrgId);
  const activeOrgName = activeOrg?.organization?.name ?? null;
  const hasMultipleOrgs = orgs.length > 1;
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="group relative overflow-hidden rounded-2xl md:rounded-3xl p-5 sm:p-6 md:p-7 mb-6 animate-fade-in bg-gradient-primary shadow-elegant ring-1 ring-white/10">
      {/* Top highlight line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
      {/* Decorative blurred orbs (animated) */}
      <div
        aria-hidden
        className="absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-30 blur-3xl animate-pulse"
        style={{ background: "oklch(0.85 0.2 330)" }}
      />
      <div
        aria-hidden
        className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full opacity-20 blur-3xl animate-pulse"
        style={{ background: "oklch(0.85 0.18 200)", animationDelay: "1.2s" }}
      />
      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Shine sweep on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1400ms] ease-out bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
      />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-white min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 text-[11px] font-medium shadow-sm">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <Calendar className="h-3 w-3" />
              <span className="capitalize">{today}</span>
            </div>
            {activeOrgName && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-[11px] font-semibold shadow-sm max-w-[260px]"
                title={`Visualizando dados exclusivos da loja: ${activeOrgName}`}
              >
                <Store className="h-3 w-3 shrink-0" />
                <span className="truncate">{activeOrgName}</span>
                {hasMultipleOrgs && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/20 ml-1 shrink-0">
                    {orgs.length} lojas
                  </span>
                )}
              </div>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-[34px] font-bold font-display tracking-tight break-words leading-tight drop-shadow-sm">
            Olá, {userName}!{" "}
            <span className="inline-block origin-[70%_70%] animate-[wave_2.4s_ease-in-out_infinite]">
              👋
            </span>
          </h1>
          <p className="text-white/85 text-sm mt-1.5 max-w-xl">
            {status ??
              (activeOrgName
                ? `Resumo em tempo real de ${activeOrgName}. Vendas, estoque e financeiro são exclusivos desta loja.`
                : "Aqui está o resumo do seu negócio em tempo real.")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={() => navigate({ to: "/pdv" })}
            className="group/btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-foreground text-sm font-semibold hover:scale-[1.04] active:scale-[0.98] transition-transform shadow-lg shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Sparkles className="h-4 w-4 text-primary group-hover/btn:rotate-12 transition-transform" />
            Nova Venda
          </button>
          <button
            onClick={() => navigate({ to: "/relatorios" as any })}
            className="group/btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <TrendingUp className="h-4 w-4" />
            Relatórios
            <ArrowUpRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}
