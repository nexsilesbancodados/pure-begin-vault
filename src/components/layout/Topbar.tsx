 import { Bell, MessageCircle, Plus, Search, ChevronDown, ArrowLeft } from "lucide-react";
 import { useNavigate, useLocation } from "@tanstack/react-router";
 import { useAuth } from "@/contexts/AuthContext";

export function Topbar({ title, subtitle, toggleSidebar }: { title: string; subtitle?: string; toggleSidebar?: () => void }) {
  const navigate = useNavigate();
   const location = useLocation();
   const { user, profile } = useAuth();
   const isHome = location.pathname === "/";

  return (
    <header className="h-[68px] sticky top-0 z-30 shrink-0 bg-card border-b border-border flex items-center gap-2 sm:gap-3 lg:gap-4 px-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button 
          className="lg:hidden p-2 rounded-md hover:bg-muted"
          onClick={toggleSidebar}
        >
          <span className="block w-5 h-0.5 bg-foreground mb-1" />
          <span className="block w-5 h-0.5 bg-foreground mb-1" />
          <span className="block w-5 h-0.5 bg-foreground" />
        </button>
      </div>
      <div className="min-w-0 flex-shrink">
        <h1 className="text-[15px] sm:text-[17px] lg:text-[20px] font-semibold tracking-tight leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="hidden sm:block text-[12.5px] text-muted-foreground mt-1 truncate">{subtitle}</p>
        )}
      </div>

      <div className="hidden md:block flex-1 max-w-xl mx-auto relative group">
        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
        <input
          placeholder="Buscar IMEI, Modelo ou Lead..."
          className="w-full h-10 lg:h-11 pl-10 pr-24 rounded-2xl bg-muted/60 border border-transparent focus:border-ring focus:bg-card outline-none text-sm placeholder:text-muted-foreground transition shadow-sm group-hover:bg-muted/80"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
           <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded border border-border bg-card text-[9px] font-bold text-muted-foreground uppercase">IMEI</span>
           <kbd className="text-[10px] font-medium text-muted-foreground bg-card border border-border rounded px-1.5 py-0.5">⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
        <button className="md:hidden h-10 w-10 grid place-items-center rounded-xl hover:bg-muted text-foreground/70">
          <Search className="h-[18px] w-[18px]" />
        </button>
        <button className="hidden sm:inline-flex items-center gap-2 h-10 px-3 lg:px-4 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-medium shadow-elegant hover:opacity-95 transition">
          <Plus className="h-4 w-4" /> <span className="hidden lg:inline">Novo Lead</span><span className="lg:hidden">Novo</span> <ChevronDown className="h-3.5 w-3.5 opacity-80" />
        </button>
        <button className="sm:hidden h-10 w-10 grid place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
          <Plus className="h-[18px] w-[18px]" />
        </button>
        <button className="relative h-10 w-10 grid place-items-center rounded-xl hover:bg-muted">
          <Bell className="h-[18px] w-[18px] text-foreground/70" />
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground grid place-items-center">6</span>
        </button>
        <button className="hidden sm:grid relative h-10 w-10 place-items-center rounded-xl hover:bg-muted">
          <MessageCircle className="h-[18px] w-[18px] text-foreground/70" />
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground grid place-items-center">3</span>
        </button>
         <div 
           className="ml-1 sm:ml-2 flex items-center gap-2.5 pl-1 sm:pl-2 pr-1 py-1 rounded-xl hover:bg-muted cursor-pointer"
           onClick={() => navigate({ to: "/configuracoes" })}
         >
           <div className="relative">
             <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-white text-sm font-semibold">
               {profile?.display_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
             </div>
             <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
           </div>
           <div className="hidden xl:block leading-tight">
             <div className="text-[13px] font-semibold">{profile?.display_name || user?.email?.split('@')[0] || "Usuário"}</div>
             <div className="text-[11px] text-muted-foreground">{profile?.role || "Usuário"}</div>
           </div>
           <ChevronDown className="hidden xl:block h-4 w-4 text-muted-foreground" />
         </div>
      </div>
    </header>
  );
}