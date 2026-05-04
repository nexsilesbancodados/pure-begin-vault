-- 1. Criar a ordem de venda
INSERT INTO public.sales_orders (
  user_id,
  customer_id,
  total_amount,
  discount_amount,
  payment_method,
  status
) VALUES (
  '133da88b-f929-4891-a1a7-50a8abb69554',
  'abe9d882-8e6b-4c7e-9996-687d4c24b2b6',
  8500.00,
  0,
  'pix',
  'concluded'
);

-- 2. Atualizar estoque do produto (diminuir 1 unidade)
UPDATE public.products 
SET stock_quantity = stock_quantity - 1 
WHERE id = 'e54a0968-1a7f-491d-946a-1709baa934ac';

-- 3. Registrar no financeiro (entrada de caixa)
INSERT INTO public.finance_transactions (
  user_id,
  type,
  amount,
  description,
  category,
  status,
  payment_date
) VALUES (
  '133da88b-f929-4891-a1a7-50a8abb69554',
  'income',
  8500.00,
  'Venda de Teste PDV - iPhone 15 Pro Max',
  'Vendas',
  'paid',
  NOW()
);