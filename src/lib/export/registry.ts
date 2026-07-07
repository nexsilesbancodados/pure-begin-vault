// Registry of exportable datasets for the Central de Exportação.
// Read-only: nomes/colunas exatamente como no banco. Não renomeia, não transforma.
export type ExportGroup =
  | "cadastros"
  | "estoque"
  | "vendas"
  | "compras"
  | "financeiro"
  | "crm"
  | "servicos"
  | "sistema";

export interface DatasetDef {
  key: string;
  label: string;
  table: string;
  group: ExportGroup;
  // Nome da coluna de organização (todas menos algumas devem ter organization_id).
  orgColumn?: string | null; // null = tabela sem escopo de loja
  // Coluna usada em filtro de período (se aplicável).
  dateColumn?: string;
  // Lista whitelist de status suportados (para filtro), opcional.
  statusColumn?: string;
  // Descrição curta pra UI.
  description?: string;
}

export const DATASETS: DatasetDef[] = [
  // ── Cadastros ───────────────────────────────────────
  { key: "products", label: "Produtos", table: "products", group: "cadastros", orgColumn: "organization_id", dateColumn: "created_at", description: "Catálogo completo de produtos (todas colunas)." },
  { key: "customers", label: "Clientes", table: "customers", group: "cadastros", orgColumn: "organization_id", dateColumn: "created_at" },
  { key: "suppliers", label: "Fornecedores", table: "suppliers", group: "cadastros", orgColumn: "organization_id", dateColumn: "created_at" },
  { key: "chart_of_accounts", label: "Plano de Contas / Categorias", table: "chart_of_accounts", group: "cadastros", orgColumn: "organization_id" },
  { key: "payment_terminals", label: "Maquininhas", table: "payment_terminals", group: "cadastros", orgColumn: "organization_id" },
  { key: "warranty_terms", label: "Termos de Garantia", table: "warranty_terms", group: "cadastros", orgColumn: "organization_id" },

  // ── Estoque ─────────────────────────────────────────
  { key: "stock_movements", label: "Movimentações de Estoque", table: "stock_movements", group: "estoque", orgColumn: "organization_id", dateColumn: "created_at" },
  { key: "product_imei", label: "IMEIs / Séries", table: "product_imei", group: "estoque", orgColumn: "organization_id", dateColumn: "created_at" },

  // ── Vendas ──────────────────────────────────────────
  { key: "sales_orders", label: "Vendas (cabeçalho)", table: "sales_orders", group: "vendas", orgColumn: "organization_id", dateColumn: "created_at", statusColumn: "status" },
  { key: "sale_items", label: "Itens de Vendas", table: "sale_items", group: "vendas", orgColumn: "organization_id" },
  { key: "sale_payments", label: "Pagamentos de Vendas", table: "sale_payments", group: "vendas", orgColumn: "organization_id" },
  { key: "quotations", label: "Orçamentos", table: "quotations", group: "vendas", orgColumn: "organization_id", dateColumn: "created_at", statusColumn: "status" },
  { key: "deliveries", label: "Entregas", table: "deliveries", group: "vendas", orgColumn: "organization_id", dateColumn: "created_at" },

  // ── Compras ─────────────────────────────────────────
  { key: "purchase_notes", label: "Compras (notas)", table: "purchase_notes", group: "compras", orgColumn: "organization_id", dateColumn: "data_compra" },

  // ── Financeiro ──────────────────────────────────────
  { key: "finance_transactions", label: "Transações Financeiras", table: "finance_transactions", group: "financeiro", orgColumn: "organization_id", dateColumn: "transaction_date", statusColumn: "type" },
  { key: "accounts_receivable", label: "Contas a Receber", table: "accounts_receivable", group: "financeiro", orgColumn: "organization_id", dateColumn: "due_date", statusColumn: "status" },
  { key: "accounts_payable", label: "Contas a Pagar", table: "accounts_payable", group: "financeiro", orgColumn: "organization_id", dateColumn: "due_date", statusColumn: "status" },
  { key: "cash_register_sessions", label: "Sessões de Caixa", table: "cash_register_sessions", group: "financeiro", orgColumn: "organization_id", dateColumn: "opened_at" },
  { key: "cash_register_movements", label: "Movimentos de Caixa", table: "cash_register_movements", group: "financeiro", orgColumn: "organization_id", dateColumn: "created_at" },
  { key: "payments", label: "Pagamentos (assinatura)", table: "payments", group: "financeiro", orgColumn: "organization_id", dateColumn: "created_at", statusColumn: "status" },

  // ── CRM ─────────────────────────────────────────────
  { key: "leads", label: "Leads", table: "leads", group: "crm", orgColumn: "organization_id", dateColumn: "created_at", statusColumn: "status" },
  { key: "pipeline_leads", label: "Pipeline (funil)", table: "pipeline_leads", group: "crm", orgColumn: "organization_id", dateColumn: "created_at" },
  { key: "funnel_stages", label: "Etapas do Funil", table: "funnel_stages", group: "crm", orgColumn: "organization_id" },
  { key: "messages", label: "Mensagens", table: "messages", group: "crm", orgColumn: "organization_id", dateColumn: "created_at" },
  { key: "bot_conversations", label: "Conversas do Bot", table: "bot_conversations", group: "crm", orgColumn: "organization_id", dateColumn: "created_at" },

  // ── Serviços / OS ──────────────────────────────────
  { key: "service_orders", label: "Ordens de Serviço", table: "service_orders", group: "servicos", orgColumn: "organization_id", dateColumn: "created_at", statusColumn: "status" },
  { key: "service_order_items", label: "Itens de OS", table: "service_order_items", group: "servicos", orgColumn: "organization_id" },
  { key: "service_order_history", label: "Histórico de OS", table: "service_order_history", group: "servicos", orgColumn: "organization_id", dateColumn: "created_at" },

  // ── Sistema ─────────────────────────────────────────
  { key: "user_organizations", label: "Usuários da Loja", table: "user_organizations", group: "sistema", orgColumn: "organization_id" },
  { key: "user_roles", label: "Papéis / Roles", table: "user_roles", group: "sistema", orgColumn: "organization_id" },
  { key: "audit_logs", label: "Auditoria", table: "audit_logs", group: "sistema", orgColumn: "organization_id", dateColumn: "created_at" },
];

export const GROUP_LABELS: Record<ExportGroup, string> = {
  cadastros: "Cadastros",
  estoque: "Estoque",
  vendas: "Vendas",
  compras: "Compras",
  financeiro: "Financeiro",
  crm: "CRM",
  servicos: "Ordens de Serviço",
  sistema: "Sistema",
};

export function getDataset(key: string): DatasetDef | undefined {
  return DATASETS.find((d) => d.key === key);
}
