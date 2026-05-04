-- Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  price DECIMAL(12,2) DEFAULT 0,
  cost_price DECIMAL(12,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  category TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own products') THEN
    CREATE POLICY "Users can manage their own products" ON public.products USING (auth.uid() = user_id);
  END IF;
END $$;

-- Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  address_zip TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own customers') THEN
    CREATE POLICY "Users can manage their own customers" ON public.customers USING (auth.uid() = user_id);
  END IF;
END $$;

-- Sales Orders Table
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  customer_id UUID REFERENCES public.customers,
  status TEXT DEFAULT 'draft',
  total_amount DECIMAL(12,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their sales') THEN
    CREATE POLICY "Users can manage their sales" ON public.sales_orders USING (auth.uid() = user_id);
  END IF;
END $$;

-- Finance Transactions Table
CREATE TABLE IF NOT EXISTS public.finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'pending',
  due_date DATE,
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their finances') THEN
    CREATE POLICY "Users can manage their finances" ON public.finance_transactions USING (auth.uid() = user_id);
  END IF;
END $$;

-- Service Orders Table
CREATE TABLE IF NOT EXISTS public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  customer_id UUID REFERENCES public.customers NOT NULL,
  status TEXT DEFAULT 'open',
  equipment TEXT,
  problem_description TEXT,
  technical_notes TEXT,
  estimated_cost DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their service orders') THEN
    CREATE POLICY "Users can manage their service orders" ON public.service_orders USING (auth.uid() = user_id);
  END IF;
END $$;

-- WhatsApp Instances Table
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  instance_name TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'disconnected',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their whatsapp instances') THEN
    CREATE POLICY "Users can manage their whatsapp instances" ON public.whatsapp_instances USING (auth.uid() = user_id);
  END IF;
END $$;
