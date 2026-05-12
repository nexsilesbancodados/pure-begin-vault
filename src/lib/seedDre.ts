import { supabase } from "@/integrations/supabase/client";

/**
 * Plano de contas pré-pronto para loja de celular brasileira.
 * Categoria DRE típica: Receita, Custo do Produto Vendido, Despesa Operacional, Despesa Adm, Não-Operacional.
 */
const DEFAULT_CHART = [
  // Receitas
  { code: "3.01", name: "Venda de aparelhos", type: "revenue", group: "Receita" },
  { code: "3.02", name: "Venda de acessórios", type: "revenue", group: "Receita" },
  { code: "3.03", name: "Serviços (assistência)", type: "revenue", group: "Receita" },
  { code: "3.04", name: "Garantia estendida", type: "revenue", group: "Receita" },
  { code: "3.05", name: "Outras receitas", type: "revenue", group: "Receita" },

  // CPV - Custo dos Produtos Vendidos
  { code: "4.01", name: "Custo aparelhos vendidos", type: "expense", group: "CPV" },
  { code: "4.02", name: "Custo acessórios vendidos", type: "expense", group: "CPV" },
  { code: "4.03", name: "Custo peças (assistência)", type: "expense", group: "CPV" },

  // Despesas operacionais
  { code: "5.01", name: "Aluguel", type: "expense", group: "Despesa Operacional" },
  { code: "5.02", name: "Energia elétrica", type: "expense", group: "Despesa Operacional" },
  { code: "5.03", name: "Internet/telefone", type: "expense", group: "Despesa Operacional" },
  { code: "5.04", name: "Água", type: "expense", group: "Despesa Operacional" },
  { code: "5.05", name: "Salários e encargos", type: "expense", group: "Despesa Operacional" },
  { code: "5.06", name: "Comissões vendedores", type: "expense", group: "Despesa Operacional" },
  { code: "5.07", name: "Material de escritório", type: "expense", group: "Despesa Operacional" },
  { code: "5.08", name: "Marketing/anúncios", type: "expense", group: "Despesa Operacional" },
  { code: "5.09", name: "Manutenção", type: "expense", group: "Despesa Operacional" },

  // Despesas administrativas
  { code: "6.01", name: "Software/SaaS", type: "expense", group: "Despesa Administrativa" },
  { code: "6.02", name: "Contador/assessoria", type: "expense", group: "Despesa Administrativa" },
  { code: "6.03", name: "Bancárias (tarifas)", type: "expense", group: "Despesa Administrativa" },
  { code: "6.04", name: "Taxas cartão", type: "expense", group: "Despesa Administrativa" },
  { code: "6.05", name: "Impostos sobre receita", type: "expense", group: "Despesa Administrativa" },
  { code: "6.06", name: "Pró-labore", type: "expense", group: "Despesa Administrativa" },

  // Não operacional
  { code: "7.01", name: "Juros recebidos", type: "revenue", group: "Não Operacional" },
  { code: "7.02", name: "Juros pagos", type: "expense", group: "Não Operacional" },
  { code: "7.03", name: "Multas pagas", type: "expense", group: "Não Operacional" },
];

export async function seedChartOfAccounts(orgId: string, userId: string) {
  const { data: existing } = await supabase
    .from("chart_of_accounts" as any)
    .select("code")
    .eq("organization_id", orgId);
  const existingCodes = new Set(((existing ?? []) as any[]).map((e) => e.code));

  const toInsert = DEFAULT_CHART
    .filter((c) => !existingCodes.has(c.code))
    .map((c) => ({
      ...c,
      organization_id: orgId,
      user_id: userId,
    }));

  if (toInsert.length === 0) return { created: 0, skipped: DEFAULT_CHART.length };

  const { error } = await (supabase as any).from("chart_of_accounts").insert(toInsert);
  if (error) throw error;
  return { created: toInsert.length, skipped: DEFAULT_CHART.length - toInsert.length };
}
