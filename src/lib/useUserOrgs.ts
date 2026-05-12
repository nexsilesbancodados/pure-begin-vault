import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface UserOrg {
  organization_id: string;
  role: string;
  is_default: boolean;
  organization: { id: string; name: string | null } | null;
}

export function useUserOrgs() {
  const { user, profile } = useAuth();
  const [orgs, setOrgs] = useState<UserOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const profileOrgId = (profile as any)?.organization_id ?? null;
  // Fallback: se profile.organization_id está vazio ou aponta pra uma org que o user
  // já não pertence, usa a primeira org de user_organizations como ativa.
  const activeOrgId = profileOrgId && orgs.some((o) => o.organization_id === profileOrgId)
    ? profileOrgId
    : (orgs.find((o) => o.is_default)?.organization_id ?? orgs[0]?.organization_id ?? null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("user_organizations")
      .select("organization_id, role, is_default, organization:organizations(id, name)")
      .eq("user_id", user.id);
    setOrgs((data as UserOrg[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const switchOrg = async (orgId: string) => {
    const { error } = await (supabase as any).rpc("switch_organization", { _org_id: orgId });
    if (error) {
      toast.error("Erro ao trocar loja: " + error.message);
      return false;
    }
    toast.success("Loja alterada");
    // hard reload pra todas queries reagirem com novo organization_id
    setTimeout(() => window.location.reload(), 600);
    return true;
  };

  const createOrg = async (name: string) => {
    const { data, error } = await (supabase as any).rpc("create_organization_for_user", { _name: name });
    if (error) {
      toast.error("Erro ao criar loja: " + error.message);
      return null;
    }
    // Se o user ainda não tem profile.organization_id, seta pra esta nova loja
    if (data && user?.id && !profileOrgId) {
      await (supabase as any).from("profiles").update({ organization_id: data }).eq("id", user.id);
    }
    toast.success("Loja criada");
    await load();
    // Hard reload pra AuthContext re-fetch profile com organization_id novo
    if (!profileOrgId) setTimeout(() => window.location.reload(), 600);
    return data as string;
  };

  return { orgs, loading, activeOrgId, switchOrg, createOrg, reload: load };
}
