import { Link } from "@tanstack/react-router";
import { Sparkles, type LucideIcon } from "lucide-react";

interface HubHeroAction {
  label: string;
  to?: string;
  onClick?: () => void;
  icon: LucideIcon;
  variant?: "primary" | "ghost";
}

interface HubHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  actions?: HubHeroAction[];
  icon?: LucideIcon;
}

export function HubHero({
  eyebrow,
  title,
  description,
  actions = [],
  icon: Icon = Sparkles,
}: HubHeroProps) {
  return (
    <div className="rounded-2xl bg-gradient-sidebar-cta p-8 text-white shadow-elegant relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-10">
        <Icon className="h-40 w-40" />
      </div>
      <div className="relative z-10 max-w-2xl">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80 mb-3">
          <Icon className="h-4 w-4" /> {eyebrow}
        </div>
        <h2 className="text-3xl font-bold font-display mb-3">{title}</h2>
        <p className="text-white/85 leading-relaxed max-w-xl">{description}</p>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-8">
            {actions.map((a, i) => {
              const cls =
                a.variant === "ghost"
                  ? "bg-white/15 backdrop-blur-md text-white hover:bg-white/25 border border-white/20"
                  : i === 0
                    ? "bg-white text-primary shadow-lg hover:opacity-90"
                    : "bg-white/15 backdrop-blur-md text-white hover:bg-white/25 border border-white/20";
              const inner = (
                <>
                  <a.icon className="h-4 w-4" /> {a.label}
                </>
              );
              const baseCls = `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${cls}`;
              if (a.to) {
                return (
                  <Link key={a.label + i} to={a.to} onClick={a.onClick} className={baseCls}>
                    {inner}
                  </Link>
                );
              }
              return (
                <button key={a.label + i} type="button" onClick={a.onClick} className={baseCls}>
                  {inner}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

