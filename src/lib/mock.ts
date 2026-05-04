export const sidebarItems = [
  { type: "header", title: "Painel Principal" },
  { title: "Dashboard", url: "/", icon: "LayoutDashboard" as const },
   { title: "Relatórios", url: "/relatorios", icon: "BarChart3" as const },
   { title: "Agentes", url: "/agentes", icon: "Headphones" as const },

  { type: "header", title: "Atendimento & CRM" },
  {
    title: "CRM",
    url: "/crm",
    icon: "Sparkles" as const,
    flyout: true,
    children: [
      { title: "Visão Geral", url: "/crm", icon: "LayoutDashboard" },
      { title: "Pipeline de Vendas", url: "/funil", icon: "Trello" },
      { title: "Bot de Atendimento", url: "/crm/bot", icon: "Bot", badge: "IA" },
      { title: "Conversas", url: "/crm/conversas", icon: "MessageSquare", badge: "Live" },
      { title: "Automações", url: "/automacao", icon: "Zap" },
      { title: "WhatsApp", url: "/whatsapp", icon: "MessageSquare" },
      { title: "Instagram", url: "/instagram", icon: "Instagram" },
    ]
  },

  { type: "header", title: "Operação Comercial" },
  { title: "Histórico de Venda", url: "/vendas/historico", icon: "History" as const },
  {
    title: "Vendas & PDV",
    url: "/vendas",
    icon: "ShoppingBag" as const,
    children: [
      { title: "Frente de Caixa (PDV)", url: "/pdv" },
      { title: "Orçamentos", url: "/vendas/orcamentos" },
      { title: "Histórico de Vendas", url: "/vendas/historico" },
      { title: "Simulador de Taxas", url: "/vendas/simulador" },
      { title: "Gestão Delivery", url: "/vendas/delivery" },
    ]
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
    ]
  },
   { title: "Base de Clientes", url: "/clientes", icon: "Users" as const },

  { type: "header", title: "Logística & Estoque" },
  {
    title: "Estoque",
    url: "/estoque",
    icon: "Box" as const,
    children: [
      { title: "Estoque Atual", url: "/estoque/atual" },
      { title: "Entrada de NF/Compras", url: "/estoque/compras" },
      { title: "Produtos Vendidos", url: "/estoque/vendidos" },
      { title: "Movimentações", url: "/estoque/movimentacoes" },
      { title: "Gerador de Etiquetas", url: "/estoque/etiquetas" },
    ]
  },
  { title: "Catálogo Produtos", url: "/produtos", icon: "Package" as const },

  { type: "header", title: "Controladoria" },
   {
     title: "Financeiro",
     url: "/financeiro",
     icon: "DollarSign" as const,
     children: [
       { title: "Fluxo de Caixa", url: "/financeiro/caixa" },
       { title: "DRE Gerencial", url: "/financeiro/dre" },
       { title: "Fornecedores", url: "/financeiro/fornecedores" },
        { title: "Maquininhas POS", url: "/financeiro/maquininhas" },
        { title: "Plano de Contas", url: "/financeiro/plano-contas" },
        { title: "Notas em Aberto", url: "/financeiro/notas-aberto" },
     ]
   },
  { title: "Fiscal (NF-e/NFC-e)", url: "/fiscal", icon: "FileText" as const },

  { type: "header", title: "Configurações" },
  { title: "Equipe", url: "/equipe", icon: "ShieldCheck" as const },
   { title: "Parametrização", url: "/configuracoes", icon: "Settings" as const, flyout: true, children: [
     { title: "Perfil da Conta", url: "/configuracoes", icon: "User" },
     { title: "Notificações", url: "/configuracoes", icon: "Bell" },
     { title: "Aparência", url: "/configuracoes", icon: "Palette" },
     { title: "Catálogo de Celulares", url: "/configuracoes", icon: "Smartphone" },
     { title: "IA DeepSeek", url: "/configuracoes", icon: "Zap" },
     { title: "Evolution API", url: "/configuracoes", icon: "Database" },
     { title: "Equipe & Permissões", url: "/configuracoes", icon: "Shield" },
     { title: "Segurança & Login", url: "/configuracoes", icon: "Lock" },
     { title: "Webhooks", url: "/configuracoes", icon: "Globe" },
   ]},
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
    { key: "novo", label: "Novo Contato", color: "var(--color-info)", count: 0, total: "R$ 0", leads: [] },
    { key: "atendimento", label: "Em Atendimento", color: "var(--color-warning)", count: 0, total: "R$ 0", leads: [] },
    { key: "proposta", label: "Proposta", color: "var(--color-primary)", count: 0, total: "R$ 0", leads: [] },
    { key: "fechado", label: "Fechado", color: "var(--color-success)", count: 0, total: "R$ 0", leads: [] },
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

  export const topPerformers: { name: string; sales: number; revenue: string; avatar: string; trend: string }[] = [];

  export const kpis = [
    { label: "Vendas do Dia", value: "R$ 0,00", trend: "0%", sub: "0 vendas hoje", icon: "ShoppingBag", tone: "success" },
    { label: "OS Abertas", value: "0", trend: "0", sub: "Aguardando peças: 0", icon: "Wrench", tone: "warning" },
    { label: "Estoque Baixo", value: "0", trend: "0", sub: "Produtos p/ reposição", icon: "Box", tone: "destructive" },
    { label: "Faturamento Mês", value: "R$ 0,00", trend: "0%", sub: "Meta: 0%", icon: "DollarSign", tone: "primary" },
    { label: "Novos Leads", value: "0", trend: "0", sub: "Via Instagram/Whats", icon: "Users", tone: "info" },
    { label: "Tickets Médio", value: "R$ 0,00", trend: "0%", sub: "Média por venda", icon: "TrendingUp", tone: "success" },
  ] as const;

