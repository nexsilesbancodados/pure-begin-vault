INSERT INTO finance_transactions (
  user_id,
  description,
  amount,
  type,
  category,
  status,
  payment_date,
  payment_methods,
  payment_account,
  recurring
) VALUES (
  '133da88b-f929-4891-a1a7-50a8abb69554',
  'Marketing Digital (Teste de Gráfico)',
  20.00,
  'expense',
  'Marketing',
  'paid',
  CURRENT_DATE,
  '[{"method": "Pix", "amount": 20}]'::jsonb,
  'Conta Principal',
  false
);