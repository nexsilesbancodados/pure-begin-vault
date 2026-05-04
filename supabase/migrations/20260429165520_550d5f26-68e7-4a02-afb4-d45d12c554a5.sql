-- Inserir um produto de teste
INSERT INTO public.products (
  user_id,
  name,
  category,
  price,
  cost_price,
  stock_quantity,
  brand,
  sku,
  model
) VALUES (
  '133da88b-f929-4891-a1a7-50a8abb69554',
  'iPhone 15 Pro Max Teste',
  'Smartphones',
  8500.00,
  6000.00,
  10,
  'apple',
  'TEST-001',
  '15 Pro Max'
);

-- Inserir um cliente de teste
INSERT INTO public.customers (
  user_id,
  full_name,
  phone
) VALUES (
  '133da88b-f929-4891-a1a7-50a8abb69554',
  'Cliente Teste',
  '11999999999'
);