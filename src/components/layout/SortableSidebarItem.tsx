import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, useLocation } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { GripVertical, HelpCircle, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SortableSidebarItemProps {
  item: any;
  isSmall: boolean;
  flyout: any;
  setFlyout: (val: any) => void;
  depth?: number;
  isOver?: boolean;
}

export const SortableSidebarItem: React.FC<SortableSidebarItemProps> = ({
  item,
  isSmall,
  flyout,
  setFlyout,
  depth = 0,
  isOver = false
}) => {
  const location = useLocation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: item.url || item.title,
    data: {
      type: item.type || 'item',
      item
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : 1,
    marginLeft: !isSmall ? `${depth * 12}px` : 0
  };

  if (item.type === "header") {
    return (
      <div ref={setNodeRef} style={style} className="group/item">
        {isSmall ? (
          <div className="h-px bg-sidebar-border/30 my-4 mx-2" />
        ) : (
          <div className="px-3 pt-4 pb-2 text-[10px] font-black uppercase tracking-widest text-sidebar-foreground/30 flex items-center gap-2">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing opacity-0 group-hover/item:opacity-100 transition-opacity">
               <GripVertical className="h-3 w-3" />
            </div>
            {item.title}
          </div>
        )}
      </div>
    );
  }

  const Icon = (Icons as any)[item.icon] || HelpCircle;
  const active = location.pathname === item.url || (item.children?.some((child: any) => location.pathname === child.url));

  const NavItem = (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "space-y-1 group/item relative transition-all duration-200",
        isDragging && "z-50",
        isOver && !isDragging && "ring-2 ring-primary/40 bg-primary/5 rounded-lg scale-[1.02]"
      )}
    >
      {!isSmall && (
        <div {...attributes} {...listeners} className="absolute -left-1 top-2.5 cursor-grab active:cursor-grabbing text-sidebar-foreground/20 hover:text-sidebar-foreground/40 opacity-0 group-hover/item:opacity-100 transition-opacity z-10">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}
      
      {item.flyout ? (
        isSmall ? (
          <button
            type="button"
            onClick={() => setFlyout(flyout?.url === item.url ? null : item)}
            className={cn(
              "group w-full relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all text-left",
              "justify-center",
              active || flyout?.url === item.url
                ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-glow"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-foreground"
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
          </button>
        ) : (
          <div className="flex items-center gap-1 pl-3">
            <Link
              to={item.url}
              preload="render"
              className={cn(
                "group relative flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-glow"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
              <span className="flex-1 truncate">{item.title}</span>
              {item.badge && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary uppercase ml-1 shrink-0">{item.badge}</span>
              )}
              {active && <ChevronRight className="h-4 w-4 ml-auto opacity-80" />}
            </Link>

            <button
              type="button"
              aria-label={flyout?.url === item.url ? `Fechar submenu de ${item.title}` : `Abrir submenu de ${item.title}`}
              onClick={() => setFlyout(flyout?.url === item.url ? null : item)}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all",
                flyout?.url === item.url
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform", flyout?.url === item.url ? "rotate-90" : "")} />
            </button>
          </div>
        )
      ) : (
        <Link
          to={item.url}
          preload="intent"
          className={cn(
            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
            isSmall ? "justify-center" : "ml-3",
            active
              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-glow"
              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-foreground"
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
          {!isSmall && <span className="flex-1 truncate">{item.title}</span>}
          {!isSmall && active && !item.children && <ChevronRight className="h-4 w-4 ml-auto opacity-80" />}
          {!isSmall && item.children && <ChevronDown className={cn("h-3.5 w-3.5 ml-auto transition-transform", active ? "rotate-180" : "")} />}
        </Link>
      )}
      
      {!isSmall && item.children && active && (
        <div className="ml-12 space-y-1 border-l border-sidebar-border/50 pl-2 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {item.children.map((child: any) => (
            <Link
              key={child.url}
              to={child.url}
              preload="intent"
              className={cn(
                "block rounded-md px-3 py-1.5 text-[12.5px] transition-colors",
                location.pathname === child.url
                  ? "text-foreground font-medium bg-primary/10"
                  : "text-sidebar-foreground/60 hover:text-foreground hover:bg-primary/5"
              )}
            >
              {child.title}
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  if (isSmall) {
    return (
      <Tooltip key={item.url || item.title}>
        <TooltipTrigger asChild>
          {NavItem}
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.title}
          {item.badge && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-white/20 uppercase">{item.badge}</span>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return NavItem;
}
