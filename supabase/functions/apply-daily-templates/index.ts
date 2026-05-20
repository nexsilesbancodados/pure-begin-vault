// One-shot DDL migration to create daily_task_templates + daily_task_completions tables.
// deno-lint-ignore-file no-explicit-any
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS public.daily_task_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL,
    created_by uuid NOT NULL,
    title text NOT NULL,
    priority text NOT NULL DEFAULT 'medium',
    time_label text,
    position int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_daily_task_templates_org
    ON public.daily_task_templates (organization_id, is_active, position)`,
  `ALTER TABLE public.daily_task_templates ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "members can read daily templates" ON public.daily_task_templates`,
  `CREATE POLICY "members can read daily templates"
    ON public.daily_task_templates FOR SELECT TO authenticated
    USING (
      organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid())
      OR organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid())
      OR created_by = auth.uid()
    )`,
  `DROP POLICY IF EXISTS "creator manages daily templates" ON public.daily_task_templates`,
  `CREATE POLICY "creator manages daily templates"
    ON public.daily_task_templates FOR ALL TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid())`,

  `CREATE TABLE IF NOT EXISTS public.daily_task_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.daily_task_templates(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (template_id, date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_daily_task_completions_org_date
    ON public.daily_task_completions (organization_id, date)`,
  `ALTER TABLE public.daily_task_completions ENABLE ROW LEVEL SECURITY`,
  `DROP POLICY IF EXISTS "members read completions" ON public.daily_task_completions`,
  `CREATE POLICY "members read completions"
    ON public.daily_task_completions FOR SELECT TO authenticated
    USING (
      organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid())
      OR organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid())
      OR user_id = auth.uid()
    )`,
  `DROP POLICY IF EXISTS "members insert completions" ON public.daily_task_completions`,
  `CREATE POLICY "members insert completions"
    ON public.daily_task_completions FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid() AND (
        organization_id IN (SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid())
        OR organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid())
        OR organization_id IN (SELECT organization_id FROM public.daily_task_templates WHERE created_by = auth.uid())
      )
    )`,

  `DROP POLICY IF EXISTS "members delete own completions" ON public.daily_task_completions`,
  `CREATE POLICY "members delete own completions"
    ON public.daily_task_completions FOR DELETE TO authenticated
    USING (user_id = auth.uid())`,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: "SUPABASE_DB_URL not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const sql = postgres(dbUrl, { prepare: false });
  const ran: string[] = [];
  try {
    for (const stmt of STATEMENTS) {
      await sql.unsafe(stmt);
      ran.push(stmt.split("\n")[0].slice(0, 80));
    }
    return new Response(JSON.stringify({ ok: true, ran }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, ran }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
});
