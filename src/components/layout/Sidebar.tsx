import { Link, useLocation } from "@tanstack/react-router";
import { iconMap, LogOut, PanelLeftClose, PanelLeftOpen, Search, Sparkles, X } from "@/lib/icons";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useImport } from "@/contexts/ImportContext";
import { sidebarItems } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { getAllowedMenuFromUser, isMenuAllowed } from "@/lib/homeScreen";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SortableSidebarItem } from "./SortableSidebarItem";

export function AppSidebar({
  open,
  setOpen,
}: {
  open?: boolean;
  setOpen?: (val: boolean) => void;
}) {
  const location = useLocation();
  const { profile, user, logout } = useAuth();
  const [flyout, setFlyout] = useState<any | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isForcedCollapsed, setIsForcedCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFlyout(null);
  }, [location.pathname]);

  useEffect(() => {
    if (flyout) setIsCollapsed(true);
  }, [flyout]);

  useEffect(() => {
    const handleForceCollapse = (e: any) => {
      setIsForcedCollapsed(e.detail);
    };
    window.addEventListener("force-sidebar-collapse", handleForceCollapse);
    return () => window.removeEventListener("force-sidebar-collapse", handleForceCollapse);
  }, []);

  // Keyboard shortcut "/" to focus sidebar search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "/") {
        e.preventDefault();
        if (isCollapsed) setIsCollapsed(false);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCollapsed]);

  const { activeCount } = useImport();

  const filteredItems = useMemo(() => {
    const role = String(profile?.role ?? "").toLowerCase();
    const isPrivileged = role === "super_admin" || 
                        role === "owner" || 
                        user?.email === "alfatech791@gmail.com" || 
                        user?.email === "contato@focussdev.art";
    const profileAllowed = (profile as any)?.allowed_menu;
    const metaAllowed = getAllowedMenuFromUser(user);
    const allowed = Array.isArray(profileAllowed) && profileAllowed.length > 0 ? profileAllowed : metaAllowed;
    const hasRestrictedMenu = !isPrivileged && Array.isArray(allowed) && allowed.length > 0;
    const isAllowed = (title: string) => !hasRestrictedMenu || isMenuAllowed(title, allowed);

    // Primeiro passe: filtra itens (e filhos) por permissão.
    const visibleItems: any[] = [];
    for (const item of sidebarItems as any[]) {
      if (item.type === "header") {
        visibleItems.push(item);
        continue;
      }
      if (item.roleRestriction === "super_admin" && profile?.role !== "super_admin") continue;

      const hasChildren = Array.isArray(item.children) && item.children.length > 0;
      const filteredChildren = hasChildren && hasRestrictedMenu
        ? item.children.filter((c: any) => isAllowed(String(c.title)))
        : item.children;

      const parentAllowed = isAllowed(String(item.title));
      const anyChildAllowed = Array.isArray(filteredChildren) && filteredChildren.length > 0;

      // Quando existe restrição: parent só aparece se ele OU pelo menos um filho for permitido.
      if (hasRestrictedMenu && !parentAllowed && !anyChildAllowed) continue;

      const next: any = { ...item, children: filteredChildren };
      if (item.url === "/importacao") {
        next.badge = activeCount > 0 ? String(activeCount) : undefined;
      }
      visibleItems.push(next);
    }

    // Segundo passe: remove headers sem itens visíveis abaixo.
    const result: any[] = [];
    for (let i = 0; i < visibleItems.length; i += 1) {
      const it = visibleItems[i];
      if (it.type === "header") {
        let hasAny = false;
        for (let j = i + 1; j < visibleItems.length; j += 1) {
          if (visibleItems[j].type === "header") break;
          hasAny = true;
          break;
        }
        if (!hasAny) continue;
      }
      result.push(it);
    }
    return result;
  }, [profile, user, activeCount]);

  // No drawer mobile o menu sempre aparece expandido (open prop só é setado no mobile).
  const isDrawerOpen = !!open;
  const isSmall = !isDrawerOpen && (isCollapsed || !!flyout || isForcedCollapsed);

  // Filtragem por busca (apenas quando expandido)
  const searchedItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || isSmall) return filteredItems;
    const out: any[] = [];
    for (const item of filteredItems) {
      if (item.type === "header") {
        out.push(item);
        continue;
      }
      const parentHit = String(item.title || "").toLowerCase().includes(q);
      const children = Array.isArray(item.children) ? item.children : [];
      const childrenHit = children.filter((c: any) =>
        String(c.title || "").toLowerCase().includes(q),
      );
      if (parentHit) {
        out.push(item);
      } else if (childrenHit.length) {
        out.push({ ...item, children: childrenHit });
      }
    }
    // Remove headers órfãos
    return out.filter((it, i) => {
      if (it.type !== "header") return true;
      const next = out[i + 1];
      return next && next.type !== "header";
    });
  }, [filteredItems, query, isSmall]);

  // Auto-fecha o drawer mobile ao navegar.
  useEffect(() => {
    if (isDrawerOpen) setOpen?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Iniciais do usuário para avatar
  const displayName =
    (profile as any)?.display_name ||
    (profile as any)?.nome ||
    user?.email?.split("@")[0] ||
    "Usuário";
  const initials = String(displayName)
    .split(/\s+/)
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const roleLabel = String((profile as any)?.role ?? "").replace(/_/g, " ");

  return (
    <TooltipProvider delayDuration={0}>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setOpen?.(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground flex flex-col transition-[transform,width] duration-300 ease-in-out lg:relative lg:translate-x-0 border-r border-sidebar-border/40 shadow-2xl lg:shadow-none",
          isSmall ? "w-[72px]" : "w-[min(86vw,300px)] lg:w-[260px]",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex items-center h-[60px] lg:h-[68px] border-b border-sidebar-border shrink-0 transition-all",
            isSmall ? "px-3 justify-center" : "px-4 lg:px-5 justify-between",
          )}
        >
          <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow shrink-0">
              <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
            </div>
            {!isSmall && (
              <div className="leading-tight animate-in fade-in slide-in-from-left-2 duration-300 min-w-0">
                <div className="font-display font-bold text-[16px] lg:text-[17px] text-foreground tracking-tight truncate">
                  ConectaCRM
                </div>
              </div>
            )}
          </div>
          {/* Botão fechar (mobile) */}
          {isDrawerOpen && (
            <button
              onClick={() => setOpen?.(false)}
              aria-label="Fechar menu"
              className="lg:hidden p-2 -mr-2 rounded-lg text-sidebar-foreground/60 hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          {/* Botão recolher (desktop) */}
          {!isSmall && !isDrawerOpen && (
            <button
              onClick={() => setIsCollapsed(true)}
              aria-label="Recolher menu lateral"
              className="hidden lg:block p-1.5 rounded-lg text-sidebar-foreground/40 hover:text-foreground hover:bg-sidebar-accent transition-colors"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
          {isSmall && !flyout && (
            <button
              onClick={() => setIsCollapsed(false)}
              aria-label="Expandir menu lateral"
              className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-sidebar-primary text-white shadow-glow grid place-items-center z-50 lg:flex hidden"
            >
              <PanelLeftOpen className="h-3 w-3" />
            </button>
          )}
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
          <div
            className={cn(
              "pt-2 border-t border-sidebar-border/40 flex flex-col gap-1",
              isSmall ? "items-center" : "",
            )}
          >
            <button
              onClick={logout}
              aria-label="Sair da conta"
              className="h-10 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-destructive/70 hover:bg-destructive/10 transition"
            >
              <LogOut className="h-4 w-4" />
              {!isSmall && <span className="text-sm font-bold">Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      {flyout && (
        <aside className="fixed inset-y-0 left-[72px] z-[60] w-[min(80vw,280px)] lg:relative lg:left-0 lg:w-[280px] shrink-0 bg-sidebar border-l border-sidebar-border/40 text-sidebar-foreground flex flex-col shadow-2xl animate-in slide-in-from-left-4 duration-300">

          <div className="flex items-center justify-between px-5 h-[68px] border-b border-sidebar-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
                {(() => {
                  const FIcon = iconMap[flyout.icon] || iconMap.HelpCircle;
                  return <FIcon className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />;
                })()}
              </div>
              <div className="leading-tight">
                <div className="font-display font-bold text-[16px] text-foreground tracking-tight">
                  {flyout.title}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/50 font-bold">
                  Menu dedicado
                </div>
              </div>
            </div>
            <button
              onClick={() => setFlyout(null)}
              className="h-8 w-8 grid place-items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-foreground transition"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
            {flyout.children?.map((child: any) => {
              const ChildIcon = child.icon ? iconMap[child.icon] : null;
              return (
                <Link
                  key={child.url}
                  to={child.url}
                  preload={false}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-all",
                    location.pathname === child.url
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-glow"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground",
                  )}
                >
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
