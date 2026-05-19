import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type OrgMember = {
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
};

export const listOrgMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orgId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ members: OrgMember[] }> => {
    const { supabase, userId } = context;

    // Authorize: caller must belong to org OR be super_admin.
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

    // Always use admin client to bypass RLS and read full team.
    const { data: rows, error: rowsErr } = await supabaseAdmin
      .from("user_organizations")
      .select("user_id, role")
      .eq("organization_id", data.orgId);

    if (rowsErr) {
      console.error("[listOrgMembers] failed to read user_organizations", rowsErr);
      throw new Error(rowsErr.message);
    }

    const base = (rows as { user_id: string; role: string }[]) ?? [];
    if (base.length === 0) return { members: [] };

    const ids = base.map((r) => r.user_id);
    const { data: profs, error: profsErr } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, display_name, email")
      .in("id", ids);

    if (profsErr) {
      console.error("[listOrgMembers] failed to read profiles", profsErr);
    }

    const map = new Map<string, { name: string | null; email: string | null }>();
    for (const p of (profs as {
      id: string;
      nome: string | null;
      display_name: string | null;
      email: string | null;
    }[]) ?? []) {
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
