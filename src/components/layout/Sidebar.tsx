import { Link, useLocation } from "@tanstack/react-router";
import {
  iconMap,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  X,
} from "@/lib/icons";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { sidebarItems } from "@/lib/mock";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SortableSidebarItem } from "./SortableSidebarItem";

export function AppSidebar({ open, setOpen }: { open?: boolean; setOpen?: (val: boolean) => void }) {
  const location = useLocation();
  const { profile, logout } = useAuth();
  const [flyout, setFlyout] = useState<any | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isForcedCollapsed, setIsForcedCollapsed] = useState(false);

  useEffect(() => { setFlyout(null); }, [location.pathname]);

  useEffect(() => {
    if (flyout) setIsCollapsed(true);
  }, [flyout]);

  useEffect(() => {
    const handleForceCollapse = (e: any) => {
      setIsForcedCollapsed(e.detail);
    };
    window.addEventListener('force-sidebar-collapse', handleForceCollapse);
    return () => window.removeEventListener('force-sidebar-collapse', handleForceCollapse);
  }, []);

  const filteredItems = useMemo(() => {
    return sidebarItems.filter((item: any) => {
      if (item.type === "header") return true;
      if (item.roleRestriction === "super_admin" && profile?.role !== 'super_admin') return false;
      return true;
    });
  }, [profile]);

  const isSmall = isCollapsed || !!flyout || isForcedCollapsed;

  return (
    <TooltipProvider delayDuration={0}>
      {open && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setOpen?.(false)} />}
      
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground flex flex-col transition-[transform,width] duration-300 ease-in-out lg:relative lg:translate-x-0 border-r border-sidebar-border/40",
        isSmall ? "w-[72px]" : "w-[260px]",
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className={cn("flex items-center h-[68px] border-b border-sidebar-border shrink-0 transition-all", isSmall ? "px-3 justify-center" : "px-5 justify-between")}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
              <Icons.Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
            </div>
            {!isSmall && <div className="leading-tight animate-in fade-in slide-in-from-left-2 duration-300"><div className="font-display font-bold text-[17px] text-foreground tracking-tight">ConectaCRM</div></div>}
          </div>
          {!isSmall && <button onClick={() => setIsCollapsed(true)} aria-label="Recolher menu lateral" className="p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-foreground hover:bg-sidebar-accent transition-colors"><Icons.PanelLeftClose className="h-4 w-4" /></button>}
          {isSmall && !flyout && <button onClick={() => setIsCollapsed(false)} aria-label="Expandir menu lateral" className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-sidebar-primary text-white shadow-glow grid place-items-center z-50 lg:flex hidden"><Icons.PanelLeftOpen className="h-3 w-3" /></button>}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
          {filteredItems.map((item: any) => (
            <SortableSidebarItem
              key={item.url || item.title}
              item={item}
              isSmall={isSmall}
              flyout={flyout}
              setFlyout={setFlyout}
            />
          ))}
        </nav>

        <div className="px-3 pb-3 mt-auto shrink-0">
          <div className={cn("pt-2 border-t border-sidebar-border/40 flex flex-col gap-1", isSmall ? "items-center" : "")}>
            <button onClick={logout} aria-label="Sair da conta" className="h-10 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-destructive/70 hover:bg-destructive/10 transition">
              <Icons.LogOut className="h-4 w-4" />
              {!isSmall && <span className="text-sm font-bold">Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      {flyout && (
        <aside className="relative z-40 w-[280px] shrink-0 bg-sidebar border-l border-sidebar-border/40 text-sidebar-foreground flex flex-col shadow-2xl animate-in slide-in-from-left-4 duration-300">
            <div className="flex items-center justify-between px-5 h-[68px] border-b border-sidebar-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
                  {(() => {
                    const FIcon = (Icons as any)[flyout.icon] || Icons.HelpCircle;
                    return <FIcon className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />;
                  })()}
                </div>
                <div className="leading-tight">
                  <div className="font-display font-bold text-[16px] text-foreground tracking-tight">{flyout.title}</div>
                  <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-bold">Menu dedicado</div>
                </div>
              </div>
              <button onClick={() => setFlyout(null)} className="h-8 w-8 grid place-items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-foreground transition" aria-label="Fechar"><Icons.X className="h-4 w-4" /></button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
              {flyout.children?.map((child: any) => {
                const ChildIcon = child.icon ? (Icons as any)[child.icon] : null;
                return (
                  <Link key={child.url} to={child.url} className={cn("group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-all", location.pathname === child.url ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-glow" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground")}>
                    {ChildIcon && <ChildIcon className="h-4 w-4 shrink-0" />}
                    <span className="flex-1 truncate">{child.title}</span>
                  </Link>
                );
              })}
            </nav>
        </aside>
      )}
    </TooltipProvider>
  );
}
