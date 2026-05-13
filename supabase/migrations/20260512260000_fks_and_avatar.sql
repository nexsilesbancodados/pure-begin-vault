-- Fixes encontrados no UI test:
-- 1. user_organizations sem FK pra organizations → PostgREST embed falha (PGRST200)
-- 2. leads.avatar_url não existe → pipeline_leads.lead:leads(name,phone,source,avatar_url) falha

-- 1. FK user_organizations → organizations
ALTER TABLE user_organizations
  DROP CONSTRAINT IF EXISTS user_organizations_organization_id_fkey;
ALTER TABLE user_organizations
  ADD CONSTRAINT user_organizations_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- FK user_organizations → auth.users (opcional, ajuda em embeds)
ALTER TABLE user_organizations
  DROP CONSTRAINT IF EXISTS user_organizations_user_id_fkey;
ALTER TABLE user_organizations
  ADD CONSTRAINT user_organizations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. leads.avatar_url
ALTER TABLE leads ADD COLUMN IF NOT EXISTS avatar_url text;

-- Recarrega o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
