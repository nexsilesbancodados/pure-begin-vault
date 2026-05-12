-- Tabelas para funcionalidades que estavam apenas como UI mock:
-- fornecedores, maquininhas, contas instagram/whatsapp adicional, checklists, termos garantia.

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  cnpj text,
  email text,
  phone text,
  contact_name text,
  address text,
  city text,
  state text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_suppliers" ON suppliers;
CREATE POLICY "org_members_suppliers" ON suppliers FOR ALL
  USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS payment_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  brand text NOT NULL,
  acquirer text,
  serial_number text,
  rates jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_terminals_org ON payment_terminals(organization_id);
ALTER TABLE payment_terminals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_terminals" ON payment_terminals;
CREATE POLICY "org_members_terminals" ON payment_terminals FOR ALL
  USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  username text NOT NULL,
  account_id text,
  access_token text,
  connected boolean DEFAULT false,
  pending_messages int DEFAULT 0,
  comments_24h int DEFAULT 0,
  auto_reply_stories boolean DEFAULT false,
  auto_reply_keywords boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insta_org ON instagram_accounts(organization_id);
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_insta" ON instagram_accounts;
CREATE POLICY "org_members_insta" ON instagram_accounts FOR ALL
  USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS service_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  description text,
  items jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklists_org ON service_checklists(organization_id);
ALTER TABLE service_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_checklists" ON service_checklists;
CREATE POLICY "org_members_checklists" ON service_checklists FOR ALL
  USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS warranty_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  category text NOT NULL,
  days int DEFAULT 90,
  content text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warranty_org ON warranty_terms(organization_id);
ALTER TABLE warranty_terms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_warranty" ON warranty_terms;
CREATE POLICY "org_members_warranty" ON warranty_terms FOR ALL
  USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

-- Realtime
DO $$
DECLARE t text; tables text[] := ARRAY['suppliers','payment_terminals','instagram_accounts','service_checklists','warranty_terms'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
