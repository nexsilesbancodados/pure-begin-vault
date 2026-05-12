-- Orçamentos e Entregas (delivery)

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  customer_id uuid,
  customer_name text NOT NULL,
  customer_phone text,
  items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  total numeric DEFAULT 0,
  status text DEFAULT 'aberto' CHECK (status IN ('aberto','enviado','aceito','recusado','convertido','expirado')),
  expires_at timestamptz,
  notes text,
  converted_sale_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_org ON quotations(organization_id, status, created_at DESC);
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_quotes" ON quotations;
CREATE POLICY "org_members_quotes" ON quotations FOR ALL
  USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  sale_order_id uuid,
  customer_name text NOT NULL,
  customer_phone text,
  address text NOT NULL,
  driver_name text,
  driver_phone text,
  status text DEFAULT 'aguardando' CHECK (status IN ('aguardando','rota','entregue','cancelado')),
  fee numeric DEFAULT 0,
  notes text,
  scheduled_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_org ON deliveries(organization_id, status, created_at DESC);
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_deliveries" ON deliveries;
CREATE POLICY "org_members_deliveries" ON deliveries FOR ALL
  USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

DO $$
DECLARE t text; tables text[] := ARRAY['quotations','deliveries'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
