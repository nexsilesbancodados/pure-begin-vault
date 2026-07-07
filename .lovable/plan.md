## Sobre o erro "Element type is invalid" no TodaySalesModal

Revisei o arquivo `src/components/dashboard/TodaySalesModal.tsx` linha a linha:
- Todos os imports (`Dialog`, `Button`, `Calendar`, `Popover`, `ScrollArea`, `Badge`) existem e exportam nomes corretos em `src/components/ui/*`.
- Todos os ícones do `lucide-react` (`ShoppingBag`, `Coins`, `Hash`, `Smartphone`, etc.) estão presentes na versão instalada.
- O único subcomponente `KPI` está definido no próprio arquivo e recebe ícones válidos.

Não há import quebrado no código atual. Esse erro casa com o padrão dos anteriores desta thread — **service worker / cache antigo** servindo um bundle onde o arquivo ainda importava algo removido. Recarregar com Ctrl+Shift+R (ou aba anônima) em `pure-begin-vault.lovable.app` costuma resolver. Não vou alterar o modal — a Sprint pediu explicitamente para não mexer em lógica existente.

Se depois do hard-refresh o erro persistir, me mande um print do modal aberto (ou o conteúdo real da linha reportada no bundle publicado) que eu ajusto pontualmente.

---

## Sprint: Central de Exportação de Dados

Módulo **somente leitura**. Nada de alterar cadastros, RLS, triggers ou lógica de negócio. Apenas consultar, agregar e gerar arquivos.

### Rota e navegação
- Nova rota: `src/routes/sistema.exportacao.tsx` (TanStack Start).
- Item no Sidebar em "Sistema" → "Exportação de Dados" (ícone `Download`), visível só para role `admin`/`owner` via `RequirePermission`.

### Camada Export Service (nova, isolada)
Diretório novo: `src/lib/export/`
- `export/registry.ts` — lista de datasets exportáveis. Cada entry:
  ```ts
  { key, label, table, defaultColumns, filters: [...], relations?: [...], group: "produtos"|"clientes"|"financeiro"|... }
  ```
- `export/fetcher.ts` — `fetchDataset(key, filters, orgId)` paginando via Supabase (batches de 1000, `.range()`), respeitando `organization_id = orgId` (nunca cruza lojas — regra core).
- `export/csv.ts` — reaproveita `src/lib/exportCsv.ts` (BOM UTF-8, escape de vírgulas/aspas). Preserva nomes de colunas originais.
- `export/xlsx.ts` — usa `xlsx` (SheetJS). Se ainda não estiver, adicionar com `bun add xlsx`.
- `export/diagnostics.ts` — funções puras de diagnóstico (contagens, órfãos, duplicados, CPF/CNPJ/IMEI inválidos). Retorna relatório, não escreve nada.
- `export/report.ts` — gera o relatório final (registros exportados, tempo, tamanho, inconsistências).

Todo dataset **passa pela Export Service** — a UI nunca chama Supabase direto.

### Datasets do registry (fase 1)
Mapear cada um para a tabela real do schema:
- `products` → produtos (todas colunas)
- `customers` → clientes
- `suppliers` → fornecedores
- `products` (view estoque atual: id, sku, name, stock_quantity, category, brand)
- `stock_movements` → movimentações
- `purchase_notes` → compras (header)
- `purchase_notes.items` (jsonb) achatado → itens de compras
- `sales_orders` → vendas (header)
- `sale_items` → itens das vendas
- `sale_payments` → pagamentos das vendas
- `finance_transactions` → financeiro geral
- `accounts_receivable` → contas a receber
- `accounts_payable` → contas a pagar
- `chart_of_accounts` → plano de contas / categorias financeiras
- `payment_terminals` → maquininhas
- `profiles` + `user_organizations` → usuários da loja
- `leads` + `pipeline_leads` → CRM
- `service_orders` + `service_order_items` + `service_order_history` → OS

Para cada exportação: preserva IDs originais (`id`, `organization_id`, `customer_id`, `product_id`, `sale_id`, etc.) — sem renomear, sem transformar tipos.

### UI da tela `sistema.exportacao.tsx`
Três abas em `<Tabs>`:

**1. Dashboard**
- 10+ `KpiCard`s com contagens (`select count(*)` por tabela filtrado por `organization_id`).
- Loading skeleton, refetch button.

**2. Exportar**
- Sidebar esquerda: grupos (Cadastros, Estoque, Vendas, Compras, Financeiro, CRM, OS).
- Painel direito: dataset selecionado + filtros (período `DateRangePicker`, status `Select`, categoria/marca `Combobox`, loja fixa na loja ativa).
- Botões: `Exportar CSV` / `Exportar Excel`.
- Progress bar durante paginação.
- Ao final: toast + card com relatório (qtd registros, tempo, tamanho, arquivo baixado).

**3. Diagnóstico**
- Tabela: nome da tabela · qtd registros · última atualização (`max(updated_at)`) · nº colunas.
- Botão "Rodar checagem de integridade" → lista órfãos, duplicados, CPFs/CNPJs/IMEIs inválidos, campos obrigatórios vazios.
- Só relatório visual — nenhuma alteração no banco.

### Filtros suportados
Implementados no `fetcher.ts` de forma genérica:
- `period` (start/end em `created_at` ou `transaction_date` conforme dataset)
- `status` (quando a tabela tiver)
- `organization_id` (sempre a loja ativa — nunca override)
- `category`, `brand` (produtos)

### Formatos
- CSV: UTF-8 com BOM, `;` como separador (compatível Excel BR), `\n` LF.
- XLSX: um sheet por dataset. Sheet extra "README" com data/hora, versão, filtros aplicados, contagens.

### Relatório final por exportação
Objeto salvo em memória (não persiste em banco):
```
{ dataset, format, filters, rows, columns, bytes, durationMs, warnings: [...] }
```
Mostrado em card + opção "Baixar relatório .json".

### O que NÃO faz nesta Sprint
- Não altera nenhuma tabela.
- Não cria migrations, RLS, triggers, funções SQL.
- Não modifica venda, PDV, financeiro, estoque, OS.
- Não implementa importação para o Premier ERP (fase posterior).
- Não expõe rota pública — tudo atrás do `_authenticated` + role admin.

### Ordem de entrega
1. `export/registry.ts` + `fetcher.ts` + `csv.ts` (fase mínima).
2. Rota + aba Dashboard + aba Exportar (apenas Produtos e Clientes) → validar formato.
3. Adicionar `xlsx.ts` + demais datasets.
4. Aba Diagnóstico + relatório final.
5. Polimento: filtros avançados, progress bar, README sheet.

Confirma que posso seguir com essa estrutura? Se preferir, começo pela fase mínima (passos 1–2) e você valida o CSV antes de eu adicionar os outros datasets.
