import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "login"
  | "logout"
  | "send_message"
  | "create_os"
  | "close_sale"
  | "discount_approval"
  | "refund"
  | "permission_change";

interface AuditParams {
  action: AuditAction | string;
  entity_type: string;
  entity_id?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Insere um audit log. Silencioso em caso de falha (não bloqueia ação principal).
 * Requer migration 20260512020000_features_extras.sql aplicada.
 */
export async function audit(params: AuditParams) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle();
    const orgId = (profile as any)?.organization_id;
    if (!orgId) return;

    await (supabase as any).from("audit_logs").insert({
      organization_id: orgId,
      user_id: user.id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id ?? null,
      metadata: params.metadata ?? {},
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
    });
  } catch (e) {
    console.warn("[audit] falhou (não bloqueia):", e);
  }
}
