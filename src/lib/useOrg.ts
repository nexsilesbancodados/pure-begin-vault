import { useAuth } from "@/contexts/AuthContext";

// Fonte única da verdade: profile do AuthContext.
// Sem cache local (estava ficando stale após criar loja / mudar de loja).
// AuthContext recarrega profile em onAuthStateChange + após criar org faz reload.

export function useOrg() {
  const { user, profile, loading } = useAuth();
  const orgId = (profile as any)?.organization_id ?? null;
  return { orgId, loading, userId: user?.id ?? null };
}

// Helper assíncrono (usado em código fora de hooks)
export async function getOrgId(userId: string): Promise<string | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  return (data as any)?.organization_id ?? null;
}
