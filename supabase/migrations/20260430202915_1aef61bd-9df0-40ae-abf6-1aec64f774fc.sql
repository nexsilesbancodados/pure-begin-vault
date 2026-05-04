DELETE FROM public.products 
WHERE name = 'Produto sem nome' 
OR (price = 0 AND cost_price = 0 AND (name IS NULL OR name = 'Produto sem nome'));