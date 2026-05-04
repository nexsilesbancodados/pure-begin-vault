-- 1. Remover produtos que ainda estão sem nome ou são irrelevantes (linhas vazias importadas)
DELETE FROM public.products 
WHERE (name = 'Produto sem nome' OR name IS NULL OR TRIM(name) = '')
AND (model IS NULL OR TRIM(model) = '')
AND (sku IS NULL OR TRIM(sku) = '');

-- 2. Garantir que preços e custos não sejam nulos (evitar erro de toLocaleString)
UPDATE public.products 
SET 
  price = COALESCE(price, 0),
  cost_price = COALESCE(cost_price, 0),
  stock_quantity = COALESCE(stock_quantity, 0);

-- 3. Limpar nomes de produtos que ficaram apenas com espaços ou strings vazias
DELETE FROM public.products WHERE TRIM(name) = '' AND (price = 0 OR price IS NULL);