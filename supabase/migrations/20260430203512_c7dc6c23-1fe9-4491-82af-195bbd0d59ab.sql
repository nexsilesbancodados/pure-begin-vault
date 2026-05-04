UPDATE public.products 
SET name = model 
WHERE (name = 'Produto sem nome' OR name IS NULL) 
AND model IS NOT NULL 
AND model <> '';