-- Add payment_methods column to store multiple payment methods
ALTER TABLE public.finance_transactions 
ADD COLUMN payment_methods JSONB DEFAULT '[]'::jsonb;

-- Comment to explain the structure
COMMENT ON COLUMN public.finance_transactions.payment_methods IS 'Stores an array of objects: { method: string, amount: number }';
