
## Escopo

Trabalhar **exclusivamente** na exportação de Estoque da Central de Exportação de Dados + corrigir o crash "Rendered more hooks than during the previous render" do FinancialAssistant. Nada em Clientes, Produtos (catálogo), Vendas, Financeiro, Compras ou banco de dados será alterado.

## Situação atual (auditada)

- Não existe uma aba "Estoque" na Central hoje. O que sai como estoque para o Premier é a coluna `estoque` dentro de `products.csv` no ZIP Premier gerado por `src/lib/export/sales.ts` (linha 1553), e **só inclui produtos referenciados por vendas do período** (`usedProductIds.has(p.id)`). Ou seja: se um produto tem saldo no Conecta mas não foi vendido no período filtrado, ele **não migra**.
- Isso é aceitável para o `products.csv` do pacote de vendas Premier, mas **inaceitável para migração de estoque**.
- O crash do FinancialAssistant está em outra aba e precisa ser estabilizado para você conseguir navegar.

## O que vou fazer

### 1. Corrigir crash do FinancialAssistant (mínimo)
- Trocar o padrão `useRef + if (persisted.current === null) …` (que reavalia quando `loadPersisted()` retorna null e pode gerar re-render extra dependendo do ambiente) por um sentinela estável (`useRef<{v: PersistedState | null} | null>(null)`) + inicialização em `useState(() => …)`.
- Sem tocar em lógica financeira, textos, filtros ou export.

### 2. Nova aba "Estoque" na Central de Exportação (Premier)

Arquivo novo: `src/components/exportacao/StockAssistant.tsx`
Ajuste mínimo: `src/routes/sistema.exportacao.tsx` (adicionar `<TabsTrigger value="estoque">` + `<TabsContent>`).

Fluxo:

```text
[Carregar snapshot] → [Validação / integridade] → [Prévia] → [Exportar CSV Premier]
                                                              ↓
                                                     [Relatório final]
```

#### 2.1 Snapshot único (uma query só, performance)
`select id, sku, ean, name, brand, model, category, stock_quantity, min_stock, location, unit, active, cost_price, price, has_imei, reference from public.products where organization_id = :org` — paginação em blocos de 1000 para suportar milhares de SKUs sem estourar o limite Supabase.

Contagem paralela via `head:true, count:'exact'` para comparação "banco × exportado".

#### 2.2 Validações antes do CSV
- Duplicados por `sku` e por `ean`
- Sem código (sem `sku` e sem `ean`)
- Sem vínculo / órfãos (sem `organization_id`)
- Quantidade negativa (`stock_quantity < 0`)
- Sem estoque (`stock_quantity = 0`) — apenas informativo, não bloqueia

Painel de resumo com contagens + lista das primeiras 10 ocorrências por tipo.

#### 2.3 Layout do CSV — **inalterado**
Mesmas colunas hoje aceitas pelo importador Premier via `products.csv` do ZIP de vendas:

`produto_id, sku, codigo_barras, nome, marca, modelo, categoria, capacidade, cor, custo, preco_venda, estoque, fornecedor_id, empresa_id, internal_code, external_code, reference, ncm, has_imei, active, location, image_url, metadata, unit, weight, min_stock, wholesale_price, created_at, updated_at`

Delimitador `,`, encoding UTF-8 com BOM, aspas ao redor de campos com vírgula — mesmo `toCsv` já usado. Nome do arquivo: `estoque_premier_YYYY-MM-DD.csv` (isolado — não altera o ZIP Premier existente).

#### 2.4 Reconciliação obrigatória (seu requisito extra)
Antes de disparar o download:

```text
Total produtos no banco:   N₁
Total produtos exportados: N₂
Soma estoque no banco:     Q₁   (SELECT sum(stock_quantity) …)
Soma estoque exportado:    Q₂

Confere 100%?  N₁ == N₂  &&  Q₁ == Q₂
```

Se divergir, mostra alerta com a diferença e lista os SKUs que ficaram de fora (com motivo: sem código, duplicado, etc.). Você decide se continua.

#### 2.5 Relatório pós-exportação
- Produtos exportados
- Produtos sem estoque
- Produtos com inconsistências (por tipo)
- Produtos ignorados (com motivo)
- Tempo (ms) e tamanho do arquivo (KB)
- Reconciliação: ✅ Confere / ⚠️ Divergência de X unidades

## O que NÃO será alterado

- `sales.ts` (Premier ERP de vendas)
- `customers.ts`, `financial.ts`, `backup.ts`, `compatibility.ts`, `registry.ts`, `fetcher.ts`
- Banco de dados, RLS, edge functions, APIs
- Todas as outras abas da Central (Dashboard, Exportar, Diagnóstico, Compat, Clientes, Vendas, Financeiro)
- Estrutura do `products.csv` do ZIP Premier atual

## Entregas ao final

- Arquivos alterados: `src/components/exportacao/StockAssistant.tsx` (novo), `src/routes/sistema.exportacao.tsx` (adicionar aba), `src/components/exportacao/FinancialAssistant.tsx` (fix hook)
- Query única auditada (com paginação)
- 12 campos exportados conforme layout Premier vigente
- Confirmação de compatibilidade (colunas / delimitador / encoding inalterados)
- Reconciliação banco × arquivo antes do download

Confirma que posso executar exatamente isso?
