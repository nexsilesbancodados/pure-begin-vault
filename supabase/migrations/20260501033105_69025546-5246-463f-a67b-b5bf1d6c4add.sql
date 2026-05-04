ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.sales_orders.items IS 'List of products sold in this order, including name, price, quantity, and technical details.';