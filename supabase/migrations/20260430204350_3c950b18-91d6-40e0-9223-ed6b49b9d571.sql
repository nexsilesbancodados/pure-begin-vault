-- Remover produtos que foram importados com preço zero (erros de importação)
DELETE FROM public.products 
WHERE (price = 0 OR price IS NULL) 
AND (cost_price = 0 OR cost_price IS NULL);

-- Garantir que não existam produtos com nomes genéricos e sem preço
DELETE FROM public.products 
WHERE (name = 'Produto sem nome' OR name IS NULL)
AND (price = 0 OR price IS NULL);