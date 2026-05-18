import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");

    // Caller identification (must be authenticated org member)
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerErr } = await userClient.auth.getUser(jwt);
    if (callerErr || !callerData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = callerData.user.id;

    const { email, password, nome, organization_id, organization_ids, role, invite_id } =
      await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!email || !organization_id) {
      return new Response(
        JSON.stringify({ error: "email e organization_id obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (password && password.length < 6) {
      return new Response(JSON.stringify({ error: "Senha mínima de 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const orgIds = Array.from(new Set(Array.isArray(organization_ids) && organization_ids.length ? organization_ids : [organization_id]));

    const [{ data: superRow }, { data: callerProfile }] = await Promise.all([
      admin.from("super_admins").select("user_id").eq("user_id", callerId).maybeSingle(),
      admin.from("profiles").select("role").eq("id", callerId).maybeSingle(),
    ]);
    const isSuperAdmin = !!superRow || String(callerProfile?.role ?? "").toLowerCase() === "super_admin";

    const { data: callerMemberships } = await admin
      .from("user_organizations")
      .select("organization_id, role")
      .eq("user_id", callerId);
    const callerOrgIds = new Set(((callerMemberships as { organization_id: string; role: string }[]) ?? [])
      .filter((m) => ["owner", "admin"].includes(String(m.role).toLowerCase()))
      .map((m) => m.organization_id));

    if (!isSuperAdmin && orgIds.some((orgId) => !callerOrgIds.has(orgId))) {
      return new Response(JSON.stringify({ error: "Sem permissão em uma das lojas selecionadas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria ou recupera usuário
    let userId: string | null = null;
    let createErr: { message?: string } | null = null;
    let created: { user: { id: string } | null } = { user: null };

    if (password) {
      const res = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: nome || normalizedEmail },
      });
      created = res.data as typeof created;
      createErr = res.error;
    } else {
      createErr = { message: "already exists" };
    }

    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // Usuário já existe -> busca e atualiza senha
        let existing = null;
        for (let page = 1; page <= 10 && !existing; page += 1) {
          const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
          if (listError) throw listError;
          existing = list?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail) ?? null;
          if ((list?.users?.length ?? 0) < 1000) break;
        }
        if (!existing) {
          return new Response(JSON.stringify({ error: "Usuário existente não encontrado" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = existing.id;
        if (password) await admin.auth.admin.updateUserById(userId, { password });
      } else {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = created.user!.id;
    }

    const memberships = orgIds.map((orgId, index) => ({
      user_id: userId!,
      organization_id: orgId,
      role: role || "employee",
      is_default: index === 0,
    }));
    await admin.from("user_organizations").update({ is_default: false }).eq("user_id", userId!);
    const { error: upsertMembershipsError } = await admin.from("user_organizations").upsert(memberships, { onConflict: "user_id,organization_id" });
    if (upsertMembershipsError) throw upsertMembershipsError;

    // Atualiza profile (já define organization_id ativa + role)
    await admin
      .from("profiles")
      .upsert(
        {
          id: userId!,
          email: normalizedEmail,
          nome: nome || normalizedEmail,
          organization_id: orgIds[0],
          role: role || "employee",
        },
        { onConflict: "id" }
      );

    // Marca convite como aceito (se houver)
    if (invite_id) {
      await admin
        .from("organization_invites")
        .update({ organization_id: orgIds[0], email: normalizedEmail, role: role || "employee", status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
        .eq("id", invite_id);
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
