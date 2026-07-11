
# Plano — Integridade Referencial do ZIP de Exportação

Objetivo: garantir que o pacote gerado (`sales.csv`, `sale_items.csv`, `sale_payments.csv`, `customers.csv`, `products.csv`, `service_orders.csv`, `service_order_items.csv`, `service_order_history.csv`, `product_imei.csv`) seja **autocontido**: nenhum filho referencia um pai ausente, nenhum FK aponta para fora do ZIP.

---

## 1. Arquitetura atual (diagnóstico)

- `src/lib/export/backup.ts` percorre o `registry.ts` dataset a dataset. Cada dataset é buscado por `fetchDataset()` de forma **independente**, aplicando `periodStart/periodEnd` só quando o registry declara `dateColumn`.
- Consequência: `sales_orders` tem `dateColumn = created_at`, mas `sale_items` / `sale_payments` **não têm** — são exportados inteiros da org.
- Mesmo problema em `service_order_items`, `service_order_history` e — para o pacote Premier (`src/lib/export/sales.ts`) — `customers.csv` / `products.csv` que hoje puxam catálogo completo.

## 2. Nova arquitetura — "Parent-Driven Export"

Substituir o loop cego por um **pipeline em fases** dentro de `backup.ts` e replicar em `sales.ts` (pacote Premier):

```
Fase A — PAIS (filtrados por período)
  sales_orders      → set S = {sale_id}
  service_orders    → set O = {os_id}

Fase B — FILHOS (derivados de S / O)
  sale_items         WHERE sale_id      IN S
  sale_payments      WHERE sale_id      IN S
  product_imei       WHERE sale_id      IN S     (ou status='sold' ∈ S)
  service_order_items    WHERE service_order_id IN O
  service_order_history  WHERE service_order_id IN O

Fase C — DIMENSÕES (derivadas dos pais)
  customers  WHERE id IN (customer_id de S ∪ O)
  products   → ver decisão em §3
  suppliers  WHERE id IN (supplier_id de products exportados)

Fase D — INDEPENDENTES (permanecem escopo-org, sem filtro relacional)
  accounts_payable / accounts_receivable / finance_transactions
  (têm seus próprios dateColumn e não são filhos de sales)
```

### Mudança concreta no `registry.ts`
Adicionar metadados relacionais:

```ts
type DatasetDef = {
  ...,
  parent?: {
    dataset: string;         // 'sales_orders'
    parentKey: string;       // 'id'
    childKey: string;        // 'sale_id'
  }
}
```

O `backup.ts` faz **topological sort** pelo grafo `parent → child` e usa os IDs coletados na Fase A como `filters.extra` (via `.in()`) para a Fase B.

### Novo helper em `fetcher.ts`
`fetchDatasetIn(ds, orgId, column, ids, chunkSize=500)` — quebra o `IN` em lotes de 500 para não estourar o limite de URL do PostgREST.

## 3. Decisão sobre `products.csv`

**Recomendação: Estratégia B (catálogo completo da org), documentada.**

Justificativa:
- O Premier importa catálogo como dimensão mestre; ativos zerados de estoque ainda precisam existir para relatórios históricos e recompras.
- Produtos são low-cardinality (média < 5k linhas por org) — impacto de tamanho desprezível.
- Restringir a "produtos vendidos no período" quebraria: (a) reimportação parcial, (b) leitura de `stock_movements` fora do período, (c) auditoria de estoque.
- Integridade referencial fica garantida porque `sale_items.product_id` sempre estará contido no catálogo completo (superset).

Mesma lógica para `suppliers`: exportar completo (dimensão mestre pequena).

`customers` **é diferente** — cresce linearmente com histórico e a maioria não participa do período. Filtrar por `IN (customer_id de S ∪ O)` reduz ZIP substancialmente e mantém integridade.

## 4. Validação automática (bloco novo no `sales.ts` / `backup.ts`)

Após montar todos os CSVs em memória, rodar `validateReferentialIntegrity()`:

```
checks = [
  { child:'sale_items',           fk:'sale_id',           parent:'sales.csv',           key:'id' },
  { child:'sale_payments',        fk:'sale_id',           parent:'sales.csv',           key:'id' },
  { child:'product_imei',         fk:'sale_id',           parent:'sales.csv',           key:'id', nullable:true },
  { child:'service_order_items',  fk:'service_order_id',  parent:'service_orders.csv',  key:'id' },
  { child:'service_order_history',fk:'service_order_id',  parent:'service_orders.csv',  key:'id' },
  { child:'sale_items',           fk:'product_id',        parent:'products.csv',        key:'id', nullable:true },
  { child:'sales',                fk:'customer_id',       parent:'customers.csv',       key:'id', nullable:true },
]
```

Cada resultado vira uma linha em `integrity_report.json` + seção em `fidelity_report.md`:
- `total_rows`, `orphans`, `orphan_ids` (top 20), `status: pass|fail`.
- Se qualquer check crítico falhar → `export_report.json.status = "warning"` e banner vermelho no `MigrationPreviewModal`.

## 5. Impacto

| Arquivo | Mudança |
|---|---|
| `src/lib/export/registry.ts` | + campo `parent`, marcar 5 datasets como filhos |
| `src/lib/export/fetcher.ts` | + `fetchDatasetIn()` com chunking |
| `src/lib/export/backup.ts` | reescrever loop → pipeline em fases (A/B/C/D) |
| `src/lib/export/sales.ts` | usar mesma pipeline; adicionar validador |
| `src/lib/export/customers.ts` | receber `customerIdSet` opcional |
| `src/components/exportacao/MigrationPreviewModal.tsx` | novo card "Integridade referencial" |
| `EXPORT_FORMAT_VERSION` | bump `1.x → 2.0` (mudança semântica no conteúdo) |

Componentes de UI/PDV/OS **não são afetados** — só o exportador.

## 6. Desempenho

- Fase A idêntica ao hoje.
- Fase B: 1 query extra por dataset filho, mas com `IN (...)` — normalmente **mais rápida** que puxar toda a tabela.
- Chunking em 500 evita URI too long; para 10k vendas → 20 requisições paralelizáveis (`Promise.all`).
- Estimativa: exportador ~10–20% mais rápido em orgs grandes (menos linhas trafegadas).

## 7. Riscos

1. **IDs muito volumosos** (>50k vendas): mitigado por chunking + `Promise.all` com concorrência 4.
2. **Registros órfãos legítimos** (ex.: `sale_items` com `product_id` de produto deletado): validador marca como `nullable:true` — warning, não fail.
3. **Compatibilidade Premier**: bump para `EXPORT_FORMAT_VERSION=2.0` sinaliza para o importador que o conjunto é agora coerente; importador antigo continua lendo (colunas idênticas).
4. **Datasets sem `dateColumn` e sem parent** (independentes financeiros): manter comportamento atual — documentado no `README.md` do ZIP.

## 8. Rollback

- Toda a mudança fica atrás de um flag `EXPORT_REFERENTIAL_INTEGRITY` (default `true`) lido de `organization_settings` ou constante.
- `false` → volta ao loop antigo do `backup.ts`.
- `EXPORT_FORMAT_VERSION` no manifest permite ao Premier detectar e tratar ambos.
- Nenhuma migração de schema; rollback é troca de flag + deploy.

## 9. Entregáveis por fase (quando aprovado)

- **Fase 1:** `registry.ts` + `fetcher.ts` (helper, sem uso) — zero impacto runtime.
- **Fase 2:** `backup.ts` pipeline + validador — atrás do flag.
- **Fase 3:** `sales.ts` (Premier) + `MigrationPreviewModal` — bump versão.
- **Fase 4:** Ativar flag por padrão + remover código legado.

## 10. Nota sobre o crash `FinancialAssistant`

Erro `Rendered more hooks than during the previous render` vem de um `return` condicional **antes** de um `useEffect`/`useMemo`. Fora do escopo deste plano; corrijo em PR separado se quiser (1 linha: mover early-return para depois de todos os hooks).

---

**Aguardando aprovação para começar pela Fase 1.**
