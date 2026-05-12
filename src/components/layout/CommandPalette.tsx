import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { User as UserIcon, Box as ProductIcon } from "lucide-react";
import {
  Search,
  ShoppingCart,
  Wrench,
  Package,
  Users,
  MessageSquare,
  DollarSign,
  BarChart3,
  Settings,
  Store,
  KeyRound,
  Receipt,
  Zap,
  Megaphone,
  Calendar,
  ClipboardList,
  Banknote,
  FileText,
  Bot,
  HelpCircle,
  Shield,
  Activity,
  Smartphone,
  TrendingUp,
  Award,
  AlertTriangle,
  Lock,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  icon: any;
  url: string;
  keywords?: string;
  group: string;
}

const COMMANDS: Command[] = [
  // Painel
  { id: "painel", label: "Dashboard / Painel", icon: BarChart3, url: "/painel", group: "Painel", keywords: "home início dash" },
  { id: "calendario", label: "Calendário", icon: Calendar, url: "/calendario", group: "Painel" },

  // CRM
  { id: "funil", label: "Funil de Vendas (Kanban)", icon: TrendingUp, url: "/funil", group: "CRM", keywords: "kanban pipeline leads" },
  { id: "leads", label: "Leads", icon: Users, url: "/leads", group: "CRM" },
  { id: "atendimento", label: "Atendimento WhatsApp/Instagram", icon: MessageSquare, url: "/atendimento", group: "CRM" },
  { id: "bot", label: "Bot IA", icon: Bot, url: "/crm/bot", group: "CRM" },
  { id: "automacoes", label: "Automações", icon: Zap, url: "/automacoes", group: "CRM", keywords: "automatico template" },
  { id: "mensagens-agendadas", label: "Mensagens Agendadas", icon: Calendar, url: "/mensagens-agendadas", group: "CRM" },
  { id: "broadcast", label: "Broadcast em massa", icon: Megaphone, url: "/broadcast", group: "CRM", keywords: "disparo" },
  { id: "whatsapp", label: "WhatsApp (instâncias)", icon: MessageSquare, url: "/whatsapp", group: "CRM" },
  { id: "templates", label: "Templates de Mensagem", icon: FileText, url: "/templates", group: "CRM" },

  // Vendas
  { id: "pdv", label: "PDV - Frente de Caixa", icon: ShoppingCart, url: "/pdv", group: "Vendas", keywords: "venda caixa" },
  { id: "caixa-pdv", label: "Caixa PDV (sangria/reforço)", icon: Banknote, url: "/caixa-pdv", group: "Vendas" },
  { id: "vendas-historico", label: "Histórico de Vendas", icon: Receipt, url: "/vendas/historico", group: "Vendas" },
  { id: "fiscal", label: "Cupons & Recibos", icon: Receipt, url: "/fiscal", group: "Vendas" },
  { id: "orcamentos", label: "Orçamentos", icon: FileText, url: "/vendas/orcamentos", group: "Vendas" },
  { id: "calculadora", label: "Calculadora de Aparelhos Usados", icon: ShoppingCart, url: "/vendas/calculadora", group: "Vendas" },
  { id: "consulta-estoque", label: "Consulta rápida estoque", icon: Search, url: "/vendas/consulta-estoque", group: "Vendas" },
  { id: "delivery", label: "Delivery", icon: Package, url: "/vendas/delivery", group: "Vendas" },
  { id: "garantias", label: "Garantias", icon: Shield, url: "/vendas/garantias", group: "Vendas" },

  // Serviços
  { id: "servicos", label: "Ordens de Serviço (OS)", icon: Wrench, url: "/servicos", group: "Serviços" },
  { id: "os-nova", label: "Nova OS", icon: Wrench, url: "/servicos/nova", group: "Serviços", keywords: "abrir os assistência" },
  { id: "os-dashboard", label: "Dashboard OS", icon: BarChart3, url: "/servicos/dashboard", group: "Serviços" },
  { id: "tecnicos", label: "Técnicos", icon: Users, url: "/servicos/tecnicos", group: "Serviços" },

  // Estoque
  { id: "estoque", label: "Estoque", icon: Package, url: "/estoque", group: "Estoque" },
  { id: "inventario", label: "Inventário (contagem física)", icon: ClipboardList, url: "/inventario", group: "Estoque", keywords: "contar" },
  { id: "etiquetas", label: "Imprimir Etiquetas", icon: FileText, url: "/estoque/etiquetas", group: "Estoque" },

  // Financeiro
  { id: "financeiro", label: "Dashboard Financeiro", icon: DollarSign, url: "/financeiro", group: "Financeiro" },
  { id: "caixa", label: "Fluxo de Caixa", icon: Banknote, url: "/financeiro/caixa", group: "Financeiro" },
  { id: "dre", label: "DRE", icon: BarChart3, url: "/financeiro/dre", group: "Financeiro" },
  { id: "conciliacao", label: "Conciliação OFX", icon: Banknote, url: "/conciliacao", group: "Financeiro" },

  // Análise
  { id: "rel-crescimento", label: "Crescimento (CAC/LTV)", icon: TrendingUp, url: "/relatorios/crescimento", group: "Análise" },
  { id: "rel-comissoes", label: "Comissões por Vendedor", icon: Award, url: "/relatorios/comissoes", group: "Análise" },
  { id: "rel-churn", label: "Análise de Churn", icon: AlertTriangle, url: "/relatorios/churn", group: "Análise" },
  { id: "rel-vip", label: "Clientes VIP (RFM)", icon: Award, url: "/relatorios/vip", group: "Análise" },

  // Lojas/Config
  { id: "lojas", label: "Minhas Lojas", icon: Store, url: "/lojas", group: "Loja" },
  { id: "equipe-loja", label: "Equipe & Convites", icon: Users, url: "/equipe-loja", group: "Loja" },
  { id: "config-loja", label: "Config Loja (Pix/PIN/Comissão)", icon: Settings, url: "/configuracoes/loja", group: "Loja" },
  { id: "configuracoes", label: "Configurações gerais", icon: Settings, url: "/configuracoes", group: "Loja" },
  { id: "integracoes", label: "Integrações externas", icon: Zap, url: "/integracoes", group: "Loja" },

  // Sistema
  { id: "api-keys", label: "API Pública (chaves)", icon: KeyRound, url: "/api-keys", group: "Sistema" },
  { id: "audit", label: "Auditoria", icon: Shield, url: "/audit-log", group: "Sistema" },
  { id: "help", label: "Central de Ajuda", icon: HelpCircle, url: "/help", group: "Sistema" },
  { id: "status", label: "Status do sistema", icon: Activity, url: "/status", group: "Sistema" },
  { id: "lgpd", label: "Privacidade / LGPD", icon: Lock, url: "/minha-conta/lgpd", group: "Sistema" },
  { id: "admin", label: "Admin SaaS (super admin)", icon: Lock, url: "/admin", group: "Sistema" },
  { id: "mobile", label: "Atendimento Mobile", icon: Smartphone, url: "/m/atendimento", group: "Sistema" },
  { id: "hardware", label: "Hardware (Impressora/Scanner)", icon: Smartphone, url: "/hardware", group: "Sistema", keywords: "usb bluetooth termica" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [dataResults, setDataResults] = useState<Command[]>([]);
  const navigate = useNavigate();
  const { orgId } = useOrg();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setDataResults([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const baseCust = (supabase as any).from("customers").select("id, name, phone").or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(5);
        const baseProd = (supabase as any).from("products").select("id, name").ilike("name", `%${q}%`).limit(5);
        const [customers, products] = await Promise.all([
          orgId ? baseCust.eq("organization_id", orgId) : baseCust,
          orgId ? baseProd.eq("organization_id", orgId) : baseProd,
        ]);
        if (cancelled) return;
        const res: Command[] = [];
        for (const c of customers.data ?? []) {
          res.push({ id: `cust-${c.id}`, label: `${c.name} · ${c.phone ?? ""}`, icon: UserIcon, url: `/clientes?id=${c.id}`, group: "Clientes" });
        }
        for (const p of products.data ?? []) {
          res.push({ id: `prod-${p.id}`, label: p.name, icon: ProductIcon, url: `/produtos?id=${p.id}`, group: "Produtos" });
        }
        setDataResults(res);
      } catch {}
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, orgId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
        setSelectedIdx(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const routeMatches = !q
      ? COMMANDS
      : COMMANDS.filter((c) => (c.label + " " + (c.keywords ?? "") + " " + c.group).toLowerCase().includes(q));
    return [...dataResults, ...routeMatches];
  }, [query, dataResults]);

  const grouped = useMemo(() => {
    const m: Record<string, Command[]> = {};
    for (const c of filtered) {
      if (!m[c.group]) m[c.group] = [];
      m[c.group].push(c);
    }
    return m;
  }, [filtered]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      e.preventDefault();
      navigate({ to: filtered[selectedIdx].url });
      setOpen(false);
    }
  };

  if (!open) return null;

  let renderIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar página, comando, ação... (↑↓ navegar, Enter abrir)"
            className="flex-1 bg-transparent outline-none text-sm font-medium"
            autoFocus
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">ESC</kbd>
        </div>

        <div className="overflow-y-auto flex-1 py-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum resultado para "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="mb-2">
                <div className="px-4 py-1 text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                  {group}
                </div>
                {items.map((c) => {
                  const isSelected = renderIdx === selectedIdx;
                  const Icon = c.icon;
                  const myIdx = renderIdx++;
                  return (
                    <button
                      key={c.id}
                      onMouseEnter={() => setSelectedIdx(myIdx)}
                      onClick={() => {
                        navigate({ to: c.url });
                        setOpen(false);
                      }}
                      className={`w-full text-left flex items-center gap-3 px-4 py-2 ${
                        isSelected ? "bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm ${isSelected ? "font-bold" : ""}`}>{c.label}</span>
                      <span className="ml-auto text-[10px] font-mono text-muted-foreground">{c.url}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>
            <kbd className="px-1 rounded bg-muted">↑↓</kbd> navegar
          </span>
          <span>
            <kbd className="px-1 rounded bg-muted">Enter</kbd> abrir
          </span>
          <span>
            <kbd className="px-1 rounded bg-muted">Esc</kbd> fechar
          </span>
          <span className="ml-auto">
            <kbd className="px-1 rounded bg-muted">⌘K</kbd> ou <kbd className="px-1 rounded bg-muted">Ctrl K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
