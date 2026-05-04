export interface AppPermissions {
  dashboard: boolean;
  vendas: boolean;
  clientes: boolean;
  pdv: boolean;
  orcamentos: boolean;
  estoque: boolean;
  servicos: boolean;
  financeiro: boolean;
  fiscal: boolean;
  relatorios: boolean;
  crm: boolean;
  configuracoes: boolean;
}

export const DEFAULT_ADMIN_PERMISSIONS: AppPermissions = {
  dashboard: true,
  vendas: true,
  clientes: true,
  pdv: true,
  orcamentos: true,
  estoque: true,
  servicos: true,
  financeiro: true,
  fiscal: true,
  relatorios: true,
  crm: true,
  configuracoes: true,
};

export const DEFAULT_EMPLOYEE_PERMISSIONS: AppPermissions = {
  dashboard: true,
  vendas: true,
  clientes: true,
  pdv: true,
  orcamentos: true,
  estoque: false,
  servicos: true,
  financeiro: false,
  fiscal: false,
  relatorios: false,
  crm: true,
  configuracoes: false,
};