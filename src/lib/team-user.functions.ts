import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SaveTeamUserAccessSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal("")),
  nome: z.string().min(1).max(200).optional(),
  organization_id: z.string().uuid(),
  organization_ids: z.array(z.string().uuid()).min(1).max(50).optional(),
  role: z.string().min(1).max(80).default("employee"),
  invite_id: z.string().uuid().optional(),
});

export const saveTeamUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveTeamUserAccessSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const callerId = context.userId;
    const selectedOrgIds = Array.from(
      new Set(data.organization_ids?.length ? data.organization_ids : [data.organization_id]),
    );
    const primaryOrgId = selectedOrgIds[0];

    const [{ data: superRow }, { data: callerProfile }] = await Promise.all([
      supabaseAdmin.from("super_admins").select("user_id").eq("user_id", callerId).maybeSingle(),
      supabaseAdmin.from("profiles").select("role").eq("id", callerId).maybeSingle(),
    ]);
    const isSuperAdmin =
      !!superRow || String(callerProfile?.role ?? "").toLowerCase() === "super_admin";

    let manageableOrgIds = selectedOrgIds;
    if (!isSuperAdmin) {
      const { data: memberships, error: membershipError } = await supabaseAdmin
        .from("user_organizations")
        .select("organization_id, role")
        .eq("user_id", callerId);
      if (membershipError) throw new Error(membershipError.message);

      manageableOrgIds = ((memberships as { organization_id: string; role: string }[]) ?? [])
        .filter((m) => ["owner", "admin"].includes(String(m.role).toLowerCase()))
        .map((m) => m.organization_id);

      const manageable = new Set(manageableOrgIds);
      if (selectedOrgIds.some((orgId) => !manageable.has(orgId))) {
        throw new Error("Sem permissão para atribuir uma das lojas selecionadas");
      }
    }

    const email = data.email.trim().toLowerCase();
    const password = data.password?.trim() || undefined;
    let targetUserId: string | null = null;

    for (let page = 1; page <= 10 && !targetUserId; page += 1) {
      const { data: usersPage, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (listError) throw new Error(listError.message);
      targetUserId = usersPage.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
      if (usersPage.users.length < 1000) break;
    }

    if (!targetUserId) {
      if (!password) throw new Error("Defina uma senha para criar este usuário");
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: data.nome || email },
      });
      if (createError) throw new Error(createError.message);
      targetUserId = created.user.id;
    } else if (password) {
      const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
        targetUserId,
        { password },
      );
      if (updatePasswordError) throw new Error(updatePasswordError.message);
    }

    const role = data.role || "employee";
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: targetUserId,
        email,
        nome: data.nome || email,
        display_name: data.nome || email,
        organization_id: primaryOrgId,
        role,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileError) throw new Error(profileError.message);

    const rows = selectedOrgIds.map((organizationId, index) => ({
      user_id: targetUserId,
      organization_id: organizationId,
      role,
      is_default: index === 0,
    }));
    await supabaseAdmin
      .from("user_organizations")
      .update({ is_default: false })
      .eq("user_id", targetUserId);

    const { error: upsertError } = await supabaseAdmin
      .from("user_organizations")
      .upsert(rows, { onConflict: "user_id,organization_id" });
    if (upsertError) throw new Error(upsertError.message);

    const { data: currentAccess } = await supabaseAdmin
      .from("user_organizations")
      .select("organization_id")
      .eq("user_id", targetUserId)
      .in("organization_id", manageableOrgIds);
    const selected = new Set(selectedOrgIds);
    const toRemove = ((currentAccess as { organization_id: string }[]) ?? []).filter(
      (row) => !selected.has(row.organization_id),
    );
    for (const row of toRemove) {
      await supabaseAdmin
        .from("user_organizations")
        .delete()
        .eq("user_id", targetUserId)
        .eq("organization_id", row.organization_id);
    }

    if (data.invite_id) {
      await supabaseAdmin
        .from("organization_invites")
        .update({
          organization_id: primaryOrgId,
          email,
          role,
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_by: targetUserId,
        })
        .eq("id", data.invite_id);
    }

    return { ok: true, user_id: targetUserId, organization_ids: selectedOrgIds };
  });
