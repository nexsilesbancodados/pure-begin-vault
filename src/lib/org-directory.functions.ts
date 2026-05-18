import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOrgSummaries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orgIds: z.array(z.string().uuid()).min(0).max(200) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const empty = {
      organizations: {} as Record<string, { name: string | null; logo_url: string | null }>,
    };
    if (data.orgIds.length === 0) return empty;

    // Prefer admin client (bypasses RLS) when env is configured; otherwise use user client.
    let client: typeof context.supabase = context.supabase;
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const mod = await import("@/integrations/supabase/client.server");
        client = mod.supabaseAdmin as unknown as typeof context.supabase;
      } catch {
        // fall back to authenticated user client
      }
    }

    const [{ data: memberships }, { data: profile }] = await Promise.all([
      client
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", context.userId)
        .in("organization_id", data.orgIds),
      client.from("profiles").select("role").eq("id", context.userId).maybeSingle(),
    ]);

    const allowedIds = new Set(
      ((memberships as { organization_id: string }[]) ?? []).map((m) => m.organization_id),
    );
    if (String((profile as { role?: string } | null)?.role ?? "").toLowerCase() === "super_admin") {
      data.orgIds.forEach((id) => allowedIds.add(id));
    }

    const ids = data.orgIds.filter((id) => allowedIds.has(id));
    if (ids.length === 0) return empty;

    const [{ data: orgRows }, { data: settingsRows }] = await Promise.all([
      client.from("organizations").select("id, name").in("id", ids),
      client
        .from("organization_settings")
        .select("organization_id, brand_logo_url")
        .in("organization_id", ids),
    ]);

    const logos = new Map(
      ((settingsRows as { organization_id: string; brand_logo_url: string | null }[]) ?? []).map(
        (row) => [row.organization_id, row.brand_logo_url],
      ),
    );
    const organizations: Record<string, { name: string | null; logo_url: string | null }> = {};
    for (const org of (orgRows as { id: string; name: string | null }[]) ?? []) {
      organizations[org.id] = { name: org.name, logo_url: logos.get(org.id) ?? null };
    }

    return { organizations };
  });
