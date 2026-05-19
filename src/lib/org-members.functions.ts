import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrgMember = {
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
};

function getAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const listOrgMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ members: OrgMember[] }> => {
    const { supabase, userId } = context;

    // 1) Try RPC (SECURITY DEFINER) — works without service role key.
    const rpc = await (supabase as any).rpc("list_organization_members", {
      _org_id: data.orgId,
    });
    if (!rpc.error && Array.isArray(rpc.data)) {
      const members: OrgMember[] = (rpc.data as any[]).map((r) => ({
        user_id: r.user_id,
        role: r.role,
        name: r.name ?? null,
        email: r.email ?? null,
      }));
      return { members };
    }
    if (rpc.error) {
      console.warn("[listOrgMembers] RPC failed, falling back", rpc.error.message);
    }

    // 2) Authorize for fallback path.
    const [{ data: self }, { data: profile }] = await Promise.all([
      supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", userId)
        .eq("organization_id", data.orgId)
        .maybeSingle(),
      supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
    ]);
    const isSuper =
      String((profile as { role?: string } | null)?.role ?? "").toLowerCase() ===
      "super_admin";
    if (!self && !isSuper) {
      throw new Error("Forbidden");
    }

    // 3) Prefer admin client when service role key is present; else user client.
    const admin = getAdmin();
    const client: any = admin ?? supabase;

    const { data: rows, error: rowsErr } = await client
      .from("user_organizations")
      .select("user_id, role")
      .eq("organization_id", data.orgId);
    if (rowsErr) throw new Error(rowsErr.message);

    const base = (rows as { user_id: string; role: string }[]) ?? [];
    if (base.length === 0) return { members: [] };

    const ids = base.map((r) => r.user_id);
    const { data: profs } = await client
      .from("profiles")
      .select("id, nome, display_name, email")
      .in("id", ids);

    const map = new Map<string, { name: string | null; email: string | null }>();
    for (const p of (profs as any[]) ?? []) {
      map.set(p.id, { name: p.display_name || p.nome || null, email: p.email });
    }

    const members: OrgMember[] = base.map((r) => ({
      user_id: r.user_id,
      role: r.role,
      name: map.get(r.user_id)?.name ?? null,
      email: map.get(r.user_id)?.email ?? null,
    }));

    return { members };
  });
