import { Link, useLocation } from "@tanstack/react-router";
import { Trello, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/funil", label: "Pipeline (Kanban)", icon: Trello },
  { to: "/leads", label: "Base de Leads", icon: Users },
] as const;

export function PipelineTabs() {
  const { pathname } = useLocation();
  return (
    <div className="mb-5 flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border w-fit">
      {tabs.map((t) => {
        const active = pathname === t.to;
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            preload="intent"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}