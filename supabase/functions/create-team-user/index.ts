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

    const { email, password, nome, organization_id, role, invite_id } =
      await req.json();

    if (!email || !password || !organization_id) {
      return new Response(
        JSON.stringify({ error: "email, password e organization_id obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Senha mínima de 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verifica se caller pertence à org (ou é super_admin)
    const { data: membership } = await admin
      .from("user_organizations")
      .select("role")
      .eq("user_id", callerId)
      .eq("organization_id", organization_id)
      .maybeSingle();

    const { data: superRow } = await admin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", callerId)
      .maybeSingle();

    if (!membership && !superRow) {
      return new Response(JSON.stringify({ error: "Sem permissão nesta loja" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria ou recupera usuário
    let userId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: nome || email },
    });

    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // Usuário já existe -> busca e atualiza senha
        const { data: list } = await admin.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existing) {
          return new Response(JSON.stringify({ error: "Usuário existente não encontrado" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = existing.id;
        await admin.auth.admin.updateUserById(userId, { password });
      } else {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = created.user!.id;
    }

    // Vincula à org
    await admin.from("user_organizations").upsert(
      {
        user_id: userId!,
        organization_id,
        role: role || "employee",
        is_default: true,
      },
      { onConflict: "user_id,organization_id" }
    );

    // Atualiza profile (já define organization_id ativa + role)
    await admin
      .from("profiles")
      .upsert(
        {
          id: userId!,
          email,
          nome: nome || email,
          organization_id,
          role: role || "employee",
        },
        { onConflict: "id" }
      );

    // Marca convite como aceito (se houver)
    if (invite_id) {
      await admin
        .from("organization_invites")
        .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
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
