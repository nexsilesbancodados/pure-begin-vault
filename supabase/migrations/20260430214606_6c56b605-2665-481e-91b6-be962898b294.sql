ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS battery_health TEXT,
ADD COLUMN IF NOT EXISTS observations TEXT;