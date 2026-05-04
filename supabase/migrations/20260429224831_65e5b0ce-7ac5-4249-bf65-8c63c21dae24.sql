INSERT INTO public.app_settings(key, value) VALUES
  ('supabase_url', 'https://htsjkvczxlrsfapkbidq.supabase.co'),
  ('anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0c2prdmN6eGxyc2ZhcGtiaWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDUwOTAsImV4cCI6MjA5Mjg4MTA5MH0.sQroXA9tjLK5vmGzMUb_ShJqo7tG2Uvzis_iTW0kXhQ')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();