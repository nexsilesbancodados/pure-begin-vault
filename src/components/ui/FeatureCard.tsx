import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type FeatureCardTone = "primary" | "info" | "success" | "warning" | "destructive" | "violet";

const tones: Record<
  FeatureCardTone,
  { icon: string; iconBg: string; arrow: string; arrowBg: string; swoosh: string }
> = {
  primary: {
    icon: "text-primary",
    iconBg: "bg-primary/10",
    arrow: "text-primary",
    arrowBg: "bg-primary/10 group-hover:bg-primary/20",
    swoosh: "from-primary/15 via-primary/5 to-transparent",
  },
  info: {
    icon: "text-info",
    iconBg: "bg-info/10",
    arrow: "text-info",
    arrowBg: "bg-info/10 group-hover:bg-info/20",
    swoosh: "from-info/15 via-info/5 to-transparent",
  },
  success: {
    icon: "text-success",
    iconBg: "bg-success/10",
    arrow: "text-success",
    arrowBg: "bg-success/10 group-hover:bg-success/20",
    swoosh: "from-success/15 via-success/5 to-transparent",
  },
  warning: {
    icon: "text-warning",
    iconBg: "bg-warning/10",
    arrow: "text-warning",
    arrowBg: "bg-warning/10 group-hover:bg-warning/20",
    swoosh: "from-warning/20 via-warning/5 to-transparent",
  },
  destructive: {
    icon: "text-destructive",
    iconBg: "bg-destructive/10",
    arrow: "text-destructive",
    arrowBg: "bg-destructive/10 group-hover:bg-destructive/20",
    swoosh: "from-destructive/15 via-destructive/5 to-transparent",
  },
  violet: {
    icon: "text-[oklch(0.55_0.22_295)]",
    iconBg: "bg-[oklch(0.55_0.22_295)]/10",
    arrow: "text-[oklch(0.55_0.22_295)]",
    arrowBg: "bg-[oklch(0.55_0.22_295)]/10 group-hover:bg-[oklch(0.55_0.22_295)]/20",
    swoosh: "from-[oklch(0.55_0.22_295)]/15 via-[oklch(0.55_0.22_295)]/5 to-transparent",
  },
};

interface FeatureCardProps {
  to?: string;
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: FeatureCardTone;
  className?: string;
  showArrow?: boolean;
  children?: React.ReactNode;
}

export function FeatureCard({
  to,
  href,
  onClick,
  icon: Icon,
  title,
  description,
  tone = "primary",
  className,
  showArrow = true,
  children,
}: FeatureCardProps) {
  const t = tones[tone];

  const content = (
    <>
      {/* Top highlight line */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
      />
      {/* Curved gradient swoosh — bottom-right */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-gradient-to-tr blur-3xl opacity-70 transition-all duration-500 group-hover:opacity-100 group-hover:scale-110",
          t.swoosh,
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 right-0 h-32 w-2/3 rounded-tl-[100%] bg-gradient-to-tr opacity-60",
          t.swoosh,
        )}
      />
      {/* Shine sweep on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out bg-gradient-to-r from-transparent via-white/[0.07] to-transparent"
      />

      <div className="relative flex items-start justify-between mb-5">
        <div
          className={cn(
            "h-12 w-12 rounded-2xl grid place-items-center ring-1 ring-inset ring-current/15 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:rotate-[-4deg] group-hover:shadow-md",
            t.iconBg,
            t.icon,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {showArrow && (
          <div
            className={cn(
              "h-9 w-9 rounded-full grid place-items-center transition-all duration-300 ring-1 ring-inset ring-current/10 group-hover:ring-current/25 group-hover:scale-105",
              t.arrowBg,
              t.arrow,
            )}
          >
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-0.5" />
          </div>
        )}
      </div>

      <div className="relative">
        <h3 className="font-bold font-display text-base mb-1 text-foreground tracking-tight">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
        {children}
      </div>
    </>
  );

  const baseClass = cn(
    "group relative overflow-hidden rounded-2xl bg-card border border-border p-5 shadow-card transition-all duration-300 hover:shadow-elegant hover:border-primary/40 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  const navigate = useNavigate();
  if (to) {
    return (
      <a
        href={to}
        className={baseClass}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
          e.preventDefault();
          onClick?.();
          navigate({ to: to as any });
        }}
      >
        {content}
      </a>
    );
  }
  if (href) {
    return (
      <a href={href} className={baseClass} onClick={onClick}>
        {content}
      </a>
    );
  }
  return (
    <div className={baseClass} onClick={onClick} role={onClick ? "button" : undefined}>
      {content}
    </div>
  );
}
