-- Adiciona display_name e role ao profiles (faltavam — quebrava onboarding).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Backfill display_name a partir de nome
UPDATE profiles SET display_name = nome WHERE display_name IS NULL AND nome IS NOT NULL;

-- Super admins: garantir display_name e role correto
UPDATE profiles p
SET role = 'owner', display_name = COALESCE(p.display_name, p.nome, 'Admin')
FROM super_admins sa
WHERE sa.user_id = p.id AND p.role IN (NULL, 'user');

-- Owner de cada org: garantir role
UPDATE profiles p
SET role = 'owner'
FROM organizations o
WHERE o.owner_id = p.id AND p.role IN (NULL, 'user');

-- Index
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
