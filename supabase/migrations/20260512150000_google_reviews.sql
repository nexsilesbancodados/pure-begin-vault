-- Google Reviews automation: configura link do Google Business e dispara WhatsApp
-- pós-venda pedindo avaliação. Tracking simples (clicou no link / não clicou).

CREATE TABLE IF NOT EXISTS google_reviews_config (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  place_id text,            -- Google Place ID (necessário pro short link)
  short_url text,            -- ex: g.page/r/<PLACE_ID>/review
  message_template text DEFAULT 'Oi {nome}! Tudo certo com seu pedido? 🙏 Se gostou do atendimento, daria pra deixar uma estrelinha pra gente? Leva 30 seg: {link}',
  send_after_hours integer DEFAULT 24,
  enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS google_review_requests (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_name text,
  customer_phone text,
  sale_order_id uuid,
  link_sent text,
  sent_at timestamptz DEFAULT now(),
  clicked_at timestamptz,
  reviewed boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_google_rev_org ON google_review_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_google_rev_sent ON google_review_requests(sent_at);

ALTER TABLE google_reviews_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_review_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_gr_config" ON google_reviews_config;
CREATE POLICY "org_members_read_gr_config" ON google_reviews_config
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "org_owners_write_gr_config" ON google_reviews_config;
CREATE POLICY "org_owners_write_gr_config" ON google_reviews_config
  FOR ALL USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND role IN ('owner','admin')));

DROP POLICY IF EXISTS "org_members_read_gr_req" ON google_review_requests;
CREATE POLICY "org_members_read_gr_req" ON google_review_requests
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));
