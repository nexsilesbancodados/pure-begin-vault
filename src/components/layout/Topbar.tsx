import {
  MessageCircle,
  Plus,
  Search,
  ChevronDown,
  Globe,
  Sun,
  Moon,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { useI18n, type Locale } from "@/lib/i18n";
import { useTheme } from "@/components/theme/ThemeProvider";
import { OrgSwitcher } from "@/components/layout/OrgSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const localeLabels: Record<Locale, string> = {
  pt: "PT",
  en: "EN",
  es: "ES",
};

export function Topbar({
  title,
  subtitle,
  toggleSidebar,
}: {
  title: string;
  subtitle?: string;
  toggleSidebar?: () => void;
}) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { locale, setLocale } = useI18n();
  const { theme, toggle } = useTheme();

  const triggerSearch = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  };

  return (
    <header className="h-[60px] sm:h-[68px] sticky top-0 z-30 shrink-0 bg-card/80 backdrop-blur-xl border-b border-border/60 flex items-center gap-2 sm:gap-3 lg:gap-4 px-2.5 sm:px-4 lg:px-6">
      {/* Mobile menu + Title */}
      <div className="flex items-center gap-2 shrink-0 min-w-0">
        <button
          className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-muted active:bg-muted/80"
          onClick={toggleSidebar}
          aria-label="Abrir menu lateral"
        >
          <span className="block w-5 h-0.5 bg-foreground mb-1" />
          <span className="block w-5 h-0.5 bg-foreground mb-1" />
          <span className="block w-5 h-0.5 bg-foreground" />
        </button>
        <div className="min-w-0">
          <h1 className="text-[15px] sm:text-[17px] lg:text-[19px] font-semibold tracking-tight leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden md:block text-[12px] text-muted-foreground mt-0.5 truncate max-w-[280px]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Search — center */}
      <button
        type="button"
        onClick={triggerSearch}
        className="hidden md:flex flex-1 max-w-md mx-auto relative group items-center text-left"
        aria-label="Abrir busca rápida"
      >
        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
        <span className="w-full h-10 pl-10 pr-14 rounded-xl bg-muted/50 border border-transparent group-hover:bg-muted/70 group-hover:border-border/60 outline-none text-sm text-muted-foreground transition-all flex items-center truncate">
          Buscar páginas, leads, produtos...
        </span>
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground/70 bg-card border border-border rounded-md px-1.5 py-0.5 shadow-sm pointer-events-none">
          ⌘K
        </kbd>
      </button>

      {/* Right cluster */}
      <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
        {/* Mobile search */}
        <button
          aria-label="Buscar"
          onClick={triggerSearch}
          className="md:hidden h-10 w-10 grid place-items-center rounded-xl hover:bg-muted text-foreground/70"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>

        {/* Primary CTA */}
        <button
          aria-label="Criar novo lead"
          className="hidden sm:inline-flex items-center gap-1.5 h-10 px-3 lg:px-4 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-elegant shadow-primary/20 hover:brightness-105 active:scale-[0.98] transition-all"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden lg:inline">Novo Lead</span>
          <span className="lg:hidden">Novo</span>
          <ChevronDown className="h-3 w-3 opacity-70 ml-0.5" />
        </button>
        <button
          aria-label="Criar novo lead"
          className="sm:hidden h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant shadow-primary/20"
        >
          <Plus className="h-[18px] w-[18px]" />
        </button>

        {/* Icon group: theme + notifications */}
        <div className="hidden sm:flex items-center gap-0.5 px-1 rounded-xl">
          <button
            onClick={toggle}
            aria-label="Alternar tema"
            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-muted text-foreground/70 transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="h-[18px] w-[18px]" />
            ) : (
              <Moon className="h-[18px] w-[18px]" />
            )}
          </button>
          <NotificationBell />
        </div>

        {/* Divider */}
        <div className="hidden md:block h-6 w-px bg-border/70 mx-0.5" />

        {/* Org switcher */}
        <div className="hidden md:block">
          <OrgSwitcher />
        </div>

        {/* Locale */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="hidden sm:flex h-9 items-center gap-1 rounded-lg px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Idioma"
            >
              <Globe className="h-4 w-4" />
              <span>{localeLabels[locale]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-24">
            {(
              [
                ["pt", "Português"],
                ["en", "English"],
                ["es", "Español"],
              ] as const
            ).map(([value, label]) => (
              <DropdownMenuItem
                key={value}
                onSelect={() => setLocale(value)}
                className={locale === value ? "font-semibold text-primary" : undefined}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Messages */}
        <button
          aria-label="Mensagens"
          className="hidden sm:grid relative h-9 w-9 place-items-center rounded-lg hover:bg-muted text-foreground/70 transition-colors"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground grid place-items-center ring-2 ring-card">
            3
          </span>
        </button>

        {/* Profile */}
        <button
          type="button"
          onClick={() => navigate({ to: "/configuracoes" })}
          className="ml-1 flex items-center gap-2 pl-1 pr-1 sm:pr-2.5 py-1 rounded-xl hover:bg-muted transition-colors group"
          aria-label="Abrir configurações"
        >
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-white text-sm font-semibold ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
              {profile?.display_name?.charAt(0).toUpperCase() ||
                user?.email?.charAt(0).toUpperCase() ||
                "U"}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
          </div>
          <div className="hidden xl:block leading-tight text-left">
            <div className="text-[13px] font-semibold truncate max-w-[120px]">
              {profile?.display_name || user?.email?.split("@")[0] || "Usuário"}
            </div>
            <div className="text-[10.5px] text-muted-foreground capitalize truncate max-w-[120px]">
              {profile?.role || "Usuário"}
            </div>
          </div>
          <ChevronDown className="hidden xl:block h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
