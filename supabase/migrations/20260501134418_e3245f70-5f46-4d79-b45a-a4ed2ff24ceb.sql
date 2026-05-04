-- Add advanced fields to finance_transactions table
ALTER TABLE public.finance_transactions 
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS payment_account TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_period TEXT,
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Comment on columns for documentation
COMMENT ON COLUMN public.finance_transactions.payment_method IS 'Forma de pagamento (Dinheiro, Cartão, Pix, etc)';
COMMENT ON COLUMN public.finance_transactions.payment_account IS 'Conta bancária ou caixa de destino/origem';
COMMENT ON COLUMN public.finance_transactions.tags IS 'Tags para filtragem e organização';
COMMENT ON COLUMN public.finance_transactions.notes IS 'Observações e detalhes adicionais';
COMMENT ON COLUMN public.finance_transactions.recurring IS 'Se o lançamento se repete automaticamente';
COMMENT ON COLUMN public.finance_transactions.recurrence_period IS 'Frequência da recorrência (daily, weekly, monthly, yearly)';
COMMENT ON COLUMN public.finance_transactions.attachment_url IS 'URL do comprovante ou anexo';