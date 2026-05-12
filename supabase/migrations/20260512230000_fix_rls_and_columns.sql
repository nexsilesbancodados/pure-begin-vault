-- Fixes para bugs encontrados no sweep test:
-- 1. INSERT em leads bloqueado: policy só tinha USING, sem WITH CHECK
-- 2. messages sem organization_id, sem channel, sem is_read, sem sender_name
-- 3. suppliers tem `document` mas frontend espera `cnpj`

-- 1. LEADS: a policy "RLS_Isolation_Leads" FOR ALL tinha USING mas sem
-- WITH CHECK e usava profiles.organization_id (que pode estar desatualizado
-- quando user pertence a múltiplas orgs). Bloqueava INSERTs.
-- Reescreve usando user_organizations + WITH CHECK explícito.
DROP POLICY IF EXISTS "RLS_Insert_Leads" ON leads;
DROP POLICY IF EXISTS "RLS_Isolation_Leads" ON leads;
CREATE POLICY "RLS_Isolation_Leads" ON leads
  FOR ALL
  USING (
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- 2. MESSAGES: adiciona colunas faltantes
ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel text DEFAULT 'whatsapp';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_name text;

CREATE INDEX IF NOT EXISTS idx_messages_org_created ON messages(organization_id, created_at DESC);

-- Backfill organization_id de messages via lead OR via profile do user
UPDATE messages m
SET organization_id = l.organization_id
FROM leads l
WHERE m.lead_id = l.id AND m.organization_id IS NULL;

UPDATE messages m
SET organization_id = p.organization_id
FROM profiles p
WHERE m.user_id = p.id AND m.organization_id IS NULL;

-- Atualiza RLS de messages: org-aware
DROP POLICY IF EXISTS "messages owner all" ON messages;
DROP POLICY IF EXISTS "messages org all" ON messages;
CREATE POLICY "messages org all" ON messages
  FOR ALL
  USING (
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- 3. SUPPLIERS: adiciona colunas que o frontend usa mas não existiam.
-- Schema antigo: id, organization_id, user_id, name, document, email, phone,
--                address, notes, created_at, updated_at
-- Frontend espera: cnpj, contact_name, city, state, active
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
-- Sincroniza valores (document → cnpj) se houver dados antigos
UPDATE suppliers SET cnpj = document WHERE cnpj IS NULL AND document IS NOT NULL;

-- (is_org_member já existe com nomes de parâmetros distintos; deixar como está)
