ALTER TABLE public.finance_transactions 
ADD COLUMN supplier_name TEXT,
ADD COLUMN products_list JSONB DEFAULT '[]'::jsonb,
ADD COLUMN invoice_number TEXT;

COMMENT ON COLUMN public.finance_transactions.supplier_name IS 'Nome do fornecedor da mercadoria ou serviço';
COMMENT ON COLUMN public.finance_transactions.products_list IS 'Lista de produtos/itens vinculados a esta nota';
COMMENT ON COLUMN public.finance_transactions.invoice_number IS 'Número do documento ou nota fiscal';