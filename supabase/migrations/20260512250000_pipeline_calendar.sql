-- Tabelas faltantes encontradas no UI test: pipeline_leads (kanban deals) e calendar_events.

CREATE TABLE IF NOT EXISTS pipeline_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES funnel_stages(id) ON DELETE SET NULL,
  deal_value numeric DEFAULT 0,
  instance_name text,
  notes text,
  expected_close_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_org ON pipeline_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage ON pipeline_leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_lead ON pipeline_leads(lead_id);

ALTER TABLE pipeline_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pipeline_leads org all" ON pipeline_leads;
CREATE POLICY "pipeline_leads org all" ON pipeline_leads
  FOR ALL
  USING (
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location text,
  attendees text[],
  reminder_minutes int DEFAULT 30,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_org_start ON calendar_events(organization_id, start_time);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calendar org all" ON calendar_events;
CREATE POLICY "calendar org all" ON calendar_events
  FOR ALL
  USING (
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Realtime
DO $$
DECLARE t text; tables text[] := ARRAY['pipeline_leads','calendar_events'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
