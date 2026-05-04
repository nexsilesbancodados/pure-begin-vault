-- Corrigir produtos sem nome usando o modelo
UPDATE public.products 
SET name = model 
WHERE (name = 'Produto sem nome' OR name IS NULL OR name = '') 
AND model IS NOT NULL 
AND model <> '';

-- Se ainda houver produtos sem nome mas com SKU ou EAN, usar isso como parte do nome temporário
UPDATE public.products 
SET name = COALESCE(brand, '') || ' ' || COALESCE(sku, ean, 'Produto')
WHERE (name = 'Produto sem nome' OR name IS NULL OR name = '')
AND (sku IS NOT NULL OR ean IS NOT NULL OR brand IS NOT NULL);