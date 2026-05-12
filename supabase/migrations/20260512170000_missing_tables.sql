-- Aditivo: índices + RLS + organization_id em tasks + realtime
-- Todas as tabelas (notifications, tasks, stock_movements) já existem com schema diferente.

-- tasks: adiciona organization_id se faltar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='organization_id') THEN
    ALTER TABLE tasks ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
    -- backfill via profile
    UPDATE tasks t SET organization_id = p.organization_id
    FROM profiles p WHERE p.id = t.user_id AND t.organization_id IS NULL;
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_notif_org_user_unread ON notifications(organization_id, user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_org_user ON tasks(organization_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_stockmov_org_product ON stock_movements(organization_id, product_id, created_at DESC);

-- RLS notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_see_own_notifications" ON notifications;
CREATE POLICY "users_see_own_notifications" ON notifications
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
    AND (user_id = auth.uid() OR user_id IS NULL)
  );
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
CREATE POLICY "users_update_own_notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

-- RLS tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_tasks" ON tasks;
CREATE POLICY "org_members_tasks" ON tasks
  FOR ALL USING (
    organization_id IS NULL OR
    organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid())
  );

-- RLS stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_members_stockmov" ON stock_movements;
CREATE POLICY "org_members_stockmov" ON stock_movements
  FOR ALL USING (organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()));

-- Realtime
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['notifications', 'tasks', 'stock_movements'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- RPC: mark_all_notifications_read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read() RETURNS integer AS $$
DECLARE
  cnt integer;
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE (user_id = auth.uid() OR user_id IS NULL)
    AND is_read = false
    AND organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = auth.uid());
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
