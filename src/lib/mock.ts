export const sidebarItems = [
  // ─── PAINEL ──────────────────────────────────────────
  { type: "header", title: "Painel" },
  { title: "Dashboard", url: "/painel", icon: "LayoutDashboard" as const },
  { title: "Calendário", url: "/calendario", icon: "Calendar" as const },
  { title: "Relatórios", url: "/relatorios", icon: "BarChart3" as const },

  // ─── ATENDIMENTO & CRM ──────────────────────────────
  { type: "header", title: "Atendimento & CRM" },
  {
    title: "CRM",
    url: "/crm",
    icon: "Sparkles" as const,
    flyout: true,
    children: [
      { title: "Inbox unificada", url: "/inbox", icon: "Inbox" },
      { title: "Pipeline de Vendas", url: "/funil", icon: "Trello" },
      { title: "Bot IA", url: "/crm/bot", icon: "Bot", badge: "IA" },
      { title: "Modelos de Mensagem", url: "/templates", icon: "FileText" },
      { title: "Automações", url: "/automacoes", icon: "Zap" },
      { title: "Mensagens Agendadas", url: "/mensagens-agendadas", icon: "Clock" },
      { title: "Broadcast em massa", url: "/broadcast", icon: "Megaphone" },
    ],
  },

  // ─── COMERCIAL ──────────────────────────────────────
  { type: "header", title: "Comercial" },
  {
    title: "Vendas & PDV",
    url: "/vendas",
    icon: "ShoppingBag" as const,
    children: [
      { title: "Frente de Caixa (PDV)", url: "/pdv" },
      { title: "Caixa (sangria/reforço)", url: "/caixa-pdv" },
      { title: "Histórico de Vendas", url: "/vendas/historico" },
      { title: "Orçamentos", url: "/vendas/orcamentos" },
      { title: "Cupons Fiscais", url: "/fiscal" },
      { title: "Simulador de Taxas", url: "/vendas/simulador" },
      { title: "Calculadora de Usados", url: "/vendas/calculadora" },
      { title: "Garantias", url: "/vendas/garantias" },
      { title: "Gestão Delivery", url: "/vendas/delivery" },
    ],
  },
  {
    title: "Serviços & OS",
    url: "/servicos",
    icon: "Wrench" as const,
    children: [
      { title: "Dashboard OS", url: "/servicos/dashboard" },
      { title: "Nova Ordem", url: "/servicos/nova" },
      { title: "Técnicos", url: "/servicos/tecnicos" },
      { title: "Checklists", url: "/servicos/checklists" },
      { title: "Termos de Garantia", url: "/servicos/termos" },
    ],
  },
  { title: "Clientes", url: "/clientes", icon: "Users" as const },

  // ─── ESTOQUE ────────────────────────────────────────
  { type: "header", title: "Estoque" },
  {
    title: "Estoque",
    url: "/estoque",
    icon: "Box" as const,
    children: [
      { title: "Estoque Atual", url: "/estoque/atual" },
      { title: "Catálogo de Produtos", url: "/produtos", icon: "Package" },
      { title: "Inventário (contagem)", url: "/inventario", icon: "ClipboardList" },
      { title: "Entrada de NF/Compras", url: "/estoque/compras" },
      { title: "Movimentações", url: "/estoque/movimentacoes" },
      { title: "Etiquetas", url: "/estoque/etiquetas" },
    ],
  },

  // ─── FINANCEIRO ─────────────────────────────────────
  { type: "header", title: "Financeiro" },
  {
    title: "Financeiro",
    url: "/financeiro",
    icon: "DollarSign" as const,
    children: [
      { title: "Despesas", url: "/financeiro/despesas", icon: "TrendingDown" },
      { title: "Receitas", url: "/financeiro/receitas", icon: "TrendingUp" },
      { title: "Caixas", url: "/financeiro/caixa", icon: "Wallet" },
      { title: "Transferência Bancária", url: "/financeiro/transferencias", icon: "ArrowLeftRight" },
      { title: "Saldo Bancário", url: "/financeiro/saldo", icon: "Landmark" },
      { title: "Movimentações Financeiras", url: "/financeiro/movimentacoes", icon: "Repeat" },
      { title: "Metas", url: "/financeiro/metas", icon: "Target" },
      { title: "Calendário", url: "/financeiro/calendario", icon: "Calendar" },
      { title: "Conciliação Bancária", url: "/conciliacao", icon: "ClipboardCheck" },
      { title: "Notas em Aberto", url: "/financeiro/notas-aberto", icon: "FileWarning" },
      { title: "DRE Gerencial", url: "/financeiro/dre", icon: "BarChart3" },
      { title: "Fornecedores", url: "/financeiro/fornecedores", icon: "Briefcase" },
      { title: "Plano de Contas", url: "/financeiro/plano-contas", icon: "ClipboardList" },
      { title: "Maquininhas POS", url: "/financeiro/maquininhas", icon: "Printer" },
      { title: "Configurações", url: "/financeiro/configuracoes", icon: "Settings" },
    ],
  },
  {
    title: "Notas",
    url: "/financeiro/notas-aberto",
    icon: "FileWarning" as const,
  },
  {
    title: "Importações",
    url: "/importacao",
    icon: "Upload" as const,
  },

  // ─── CONFIGURAÇÕES ──────────────────────────────────
  { type: "header", title: "Configurações" },
  {
    title: "Loja",
    url: "/lojas",
    icon: "Store" as const,
    children: [
      { title: "Minhas Lojas", url: "/lojas", icon: "Store" },
      { title: "Equipe da Loja", url: "/equipe-loja", icon: "UserPlus" },
      { title: "Agentes / Atendentes", url: "/agentes", icon: "Headphones" },
      { title: "Hardware", url: "/hardware", icon: "Printer" },
      { title: "Config. (Pix/PIN/Comissão)", url: "/configuracoes/loja", icon: "Settings" },
    ],
  },
  {
    title: "Sistema",
    url: "/configuracoes",
    icon: "Settings" as const,
    children: [
      { title: "Parametrização", url: "/configuracoes", icon: "Settings" },
      { title: "Integrações externas", url: "/integracoes", icon: "Zap" },
      { title: "Avaliações Google", url: "/google-reviews", icon: "Star" },
      { title: "API Pública", url: "/api-keys", icon: "Key" },
      { title: "Auditoria", url: "/audit-log", icon: "Shield" },
    ],
  },
  {
    title: "Minha Conta",
    url: "/minha-conta",
    icon: "User" as const,
    children: [
      { title: "Conta", url: "/minha-conta", icon: "User" },
      { title: "Cobranças", url: "/minha-conta/cobrancas", icon: "Receipt" },
      { title: "Segurança / 2FA", url: "/minha-conta/seguranca", icon: "Lock" },
      { title: "Privacidade (LGPD)", url: "/minha-conta/lgpd", icon: "Shield" },
    ],
  },

  // ─── RODAPÉ ─────────────────────────────────────────
  { type: "header", title: "Mais" },
  { title: "Programa de Afiliados", url: "/afiliados", icon: "Award" as const, badge: "30%" },
  { title: "Central de Ajuda", url: "/help", icon: "HelpCircle" as const },
  { title: "Admin SaaS", url: "/admin", icon: "Lock" as const, roleRestriction: "super_admin" },
] as any;

export interface ServiceOrder {
  id: string;
  customer: string;
  device: string;
  problem: string;
  status: "Aguardando" | "Em Análise" | "Aprovado" | "Pronto" | "Entregue";
  priority: "Baixa" | "Média" | "Alta" | "Urgente";
  date: string;
  value?: number;
}

export const serviceOrders: ServiceOrder[] = [];

export const salesData = [];

export const originData: { name: string; value: number; color: string }[] = [];

export const channelSeries = [];

export interface Lead {
  name: string;
  avatar: string;
  channel: string;
  time: string;
  won?: boolean;
}

export interface FunnelStage {
  key: string;
  label: string;
  color: string;
  count: number;
  total: string;
  leads: Lead[];
}

export const funnelStages: FunnelStage[] = [
  {
    key: "novo",
    label: "Novo Contato",
    color: "var(--color-info)",
    count: 0,
    total: "R$ 0",
    leads: [],
  },
  {
    key: "atendimento",
    label: "Em Atendimento",
    color: "var(--color-warning)",
    count: 0,
    total: "R$ 0",
    leads: [],
  },
  {
    key: "proposta",
    label: "Proposta",
    color: "var(--color-primary)",
    count: 0,
    total: "R$ 0",
    leads: [],
  },
  {
    key: "fechado",
    label: "Fechado",
    color: "var(--color-success)",
    count: 0,
    total: "R$ 0",
    leads: [],
  },
];

export interface Message {
  name: string;
  time: string;
  text: string;
  channel: string;
  unread: number;
}
export const messages: Message[] = [];

export interface Task {
  text: string;
  count: number;
  done: boolean;
}
export const tasks: Task[] = [];

export interface AgendaItem {
  time: string;
  title: string;
}
export const agenda: AgendaItem[] = [];

export interface Automation {
  name: string;
  next: string;
  count: number;
  status: string;
}
export const automations: Automation[] = [];

export interface RecentLead {
  name: string;
  origin: string;
  responsavel: string;
  etapa: string;
  time: string;
}
export const recentLeads: RecentLead[] = [];

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  imei?: string;
  image?: string;
  reference?: string;
  brand?: string;
  ncm?: string;
  ean?: string;
  unit?: string;
  description?: string;
  model?: string;
  capacity?: string;
  color?: string;
  battery_health?: string;
}

export const products: Product[] = [];

export const funnelData: { name: string; value: number; color: string }[] = [];

export const topPerformers: {
  name: string;
  sales: number;
  revenue: string;
  avatar: string;
  trend: string;
}[] = [];

export const kpis = [
  {
    label: "Vendas do Dia",
    value: "R$ 0,00",
    trend: "0%",
    sub: "0 vendas hoje",
    icon: "ShoppingBag",
    tone: "success",
  },
  {
    label: "OS Abertas",
    value: "0",
    trend: "0",
    sub: "Aguardando peças: 0",
    icon: "Wrench",
    tone: "warning",
  },
  {
    label: "Estoque Baixo",
    value: "0",
    trend: "0",
    sub: "Produtos p/ reposição",
    icon: "Box",
    tone: "destructive",
  },
  {
    label: "Faturamento Mês",
    value: "R$ 0,00",
    trend: "0%",
    sub: "Meta: 0%",
    icon: "DollarSign",
    tone: "primary",
  },
  {
    label: "Novos Leads",
    value: "0",
    trend: "0",
    sub: "Via Instagram/Whats",
    icon: "Users",
    tone: "info",
  },
  {
    label: "Tickets Médio",
    value: "R$ 0,00",
    trend: "0%",
    sub: "Média por venda",
    icon: "TrendingUp",
    tone: "success",
  },
] as const;
