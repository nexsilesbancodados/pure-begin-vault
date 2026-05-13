import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { sidebarItems } from "@/lib/mock";
import { iconMap } from "@/lib/icons";
import { ArrowRight } from "lucide-react";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface Entry {
  group: string;
  title: string;
  url: string;
  icon?: string;
  keywords?: string;
}

function buildEntries(): Entry[] {
  const out: Entry[] = [];
  let currentGroup = "Navegação";
  for (const it of sidebarItems as any[]) {
    if (it?.type === "header") {
      currentGroup = it.title;
      continue;
    }
    if (it?.url) {
      out.push({ group: currentGroup, title: it.title, url: it.url, icon: it.icon });
    }
    if (Array.isArray(it?.children)) {
      for (const c of it.children) {
        out.push({
          group: it.title,
          title: c.title,
          url: c.url,
          icon: c.icon ?? it.icon,
          keywords: it.title,
        });
      }
    }
  }
  return out;
}

export function CommandPalette({ open: openProp, onOpenChange }: CommandPaletteProps = {}) {
  const navigate = useNavigate();
  const entries = useMemo(buildEntries, []);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? !!openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  useEffect(() => {
    if (isControlled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setInternalOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isControlled]);

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      if (!map.has(e.group)) map.set(e.group, []);
      map.get(e.group)!.push(e);
    }
    return Array.from(map.entries());
  }, [entries]);

  const go = (url: string) => {
    onOpenChange(false);
    navigate({ to: url });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar páginas, módulos, ações..." />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {grouped.map(([group, items], gi) => (
          <div key={group}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((e) => {
                const Icon = e.icon ? iconMap[e.icon] : undefined;
                return (
                  <CommandItem
                    key={`${group}-${e.url}`}
                    value={`${e.title} ${e.keywords ?? ""} ${e.url}`}
                    onSelect={() => go(e.url)}
                    className="gap-3"
                  >
                    {Icon ? (
                      <span className="h-7 w-7 rounded-lg bg-muted grid place-items-center text-foreground/70 shrink-0">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="h-7 w-7" />
                    )}
                    <span className="flex-1 text-sm">{e.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                      {e.url}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/** Hook: opens the palette via Cmd+K / Ctrl+K. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
