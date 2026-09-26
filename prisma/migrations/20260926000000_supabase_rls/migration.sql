-- Supabase exposes the public schema through its REST "Data API".
-- Enabling Row Level Security with no policies blocks all access through that API,
-- while the app's own database connection (table owner) is unaffected.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
