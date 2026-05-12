-- Habilita realtime nas tabelas críticas (inbox, funil, OS, vendas).
-- Permite o app receber INSERT/UPDATE/DELETE via WebSocket.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['leads', 'messages', 'sales_orders', 'service_orders', 'finance_transactions', 'notifications'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- REPLICA IDENTITY FULL pra UPDATEs trazerem row completo
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['leads', 'messages', 'sales_orders', 'service_orders', 'finance_transactions', 'notifications'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      BEGIN
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
END $$;
