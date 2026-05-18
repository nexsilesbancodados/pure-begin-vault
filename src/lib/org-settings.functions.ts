import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SaveSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  brand_logo_url: z.string().max(2000).nullable().optional(),
  support_email: z.string().max(200).nullable().optional(),
  support_whatsapp: z.string().max(50).nullable().optional(),
});

export const saveOrgSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verifica permissão: super_admin OU owner/admin da org
    const [saRes, memRes] = await Promise.all([
      (supabase as any)
        .from("super_admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_organizations")
        .select("role")
        .eq("user_id", userId)
        .eq("organization_id", data.orgId)
        .maybeSingle(),
    ]);

    const isSuper = !!saRes.data;
    const role = (memRes.data as any)?.role;
    const canEdit = isSuper || role === "owner" || role === "admin";
    if (!canEdit) throw new Error("Sem permissão para editar esta loja");

    // Atualiza nome da loja
    if (data.name) {
      const { error: e1 } = await supabase
        .from("organizations")
        .update({ name: data.name, updated_at: new Date().toISOString() })
        .eq("id", data.orgId);
      if (e1) throw new Error(e1.message);
    }

    // Upsert configurações da marca / contato
    const payload: Record<string, unknown> = { organization_id: data.orgId };
    if (data.name !== undefined) payload.brand_name = data.name;
    if (data.brand_logo_url !== undefined) payload.brand_logo_url = data.brand_logo_url;
    if (data.support_email !== undefined) payload.support_email = data.support_email;
    if (data.support_whatsapp !== undefined) payload.support_whatsapp = data.support_whatsapp;

    const { error: e2 } = await (supabase as any)
      .from("organization_settings")
      .upsert(payload, { onConflict: "organization_id" });
    if (e2) throw new Error(e2.message);

    return { ok: true };
  });
