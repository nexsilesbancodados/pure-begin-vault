import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useServerFn } from "@tanstack/react-start";
import { getOrgSummaries } from "@/lib/org-directory.functions";
import { toast } from "sonner";

export interface UserOrg {
  organization_id: string;
  role: string;
  is_default: boolean;
  organization: { id: string; name: string | null } | null;
  logo_url?: string | null;
}

type OrgRow = { id: string; name: string | null };
type MembershipRow = Omit<UserOrg, "organization" | "logo_url"> & {
  organization: OrgRow | OrgRow[] | null;
};

export function useUserOrgs() {
  const { user, profile } = useAuth();
  const [orgs, setOrgs] = useState<UserOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchOrgSummaries = useServerFn(getOrgSummaries);
  const profileOrgId = profile?.organization_id ?? null;
  // Fallback: se profile.organization_id está vazio ou aponta pra uma org que o user
  // já não pertence, usa a primeira org de user_organizations como ativa.
  const activeOrgId =
    profileOrgId && orgs.some((o) => o.organization_id === profileOrgId)
      ? profileOrgId
      : (orgs.find((o) => o.is_default)?.organization_id ?? orgs[0]?.organization_id ?? null);

  const isSuperAdmin = 
    profile?.role === "super_admin" || 
    user?.email === "alfatech791@gmail.com" || 
    user?.email === "contato@focussdev.art";

  const load = useCallback(async () => {
    if (!user?.id) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("user_organizations")
      .select("organization_id, role, is_default, organization:organizations(id, name)")
      .eq("user_id", user.id);

    let base: UserOrg[] = ((data as unknown as MembershipRow[]) ?? []).map((row) => ({
      organization_id: row.organization_id,
      role: row.role,
      is_default: row.is_default,
      organization: Array.isArray(row.organization)
        ? (row.organization[0] ?? null)
        : row.organization,
    }));

    // Super admin: pode ver e gerenciar TODAS as lojas, mesmo as que não é membro
    if (isSuperAdmin) {
      const { data: allOrgs } = await supabase.from("organizations").select("id, name");
      const existing = new Set(base.map((o) => o.organization_id));
      const extras: UserOrg[] = ((allOrgs as OrgRow[]) ?? [])
        .filter((o) => !existing.has(o.id))
        .map((o) => ({
          organization_id: o.id,
          role: "super_admin",
          is_default: false,
          organization: { id: o.id, name: o.name },
        }));
      base = [...base, ...extras];
    }

    const ids = base.map((o) => o.organization_id);
    let orgSummaryMap: Record<string, { name: string | null; logo_url: string | null }> = {};
    if (ids.length > 0) {
      try {
        const res = await fetchOrgSummaries({ data: { orgIds: ids } });
        orgSummaryMap = res.organizations ?? {};
      } catch (e) {
        console.warn("Falha ao carregar detalhes das lojas", e);
      }
    }
    setOrgs(
      base.map((o) => {
        const summary = orgSummaryMap[o.organization_id];
        return {
          ...o,
          organization: o.organization?.name
            ? o.organization
            : { id: o.organization_id, name: summary?.name ?? null },
          logo_url: summary?.logo_url ?? null,
        };
      }),
    );
    setLoading(false);
  }, [user?.id, isSuperAdmin, fetchOrgSummaries]);

  useEffect(() => {
    load();
  }, [load]);

  const switchOrg = async (orgId: string) => {
    const target = orgs.find((o) => o.organization_id === orgId);
    const targetName = target?.organization?.name ?? "loja";
    const { error } = await supabase.rpc("switch_organization", { _org_id: orgId });
    if (error) {
      toast.error("Erro ao trocar loja: " + error.message);
      return false;
    }
    toast.success(`Alternando para "${targetName}" — dados isolados desta loja`);
    // hard reload pra todas queries reagirem com novo organization_id
    setTimeout(() => window.location.reload(), 600);
    return true;
  };

  const createOrg = async (name: string) => {
    const { data, error } = await supabase.rpc("create_organization_for_user", {
      _name: name,
    });
    if (error) {
      toast.error("Erro ao criar loja: " + error.message);
      return null;
    }
    // Se o user ainda não tem profile.organization_id, seta pra esta nova loja
    if (data && user?.id && !profileOrgId) {
      await supabase.from("profiles").update({ organization_id: data }).eq("id", user.id);
    }
    toast.success("Loja criada");
    await load();
    // Hard reload pra AuthContext re-fetch profile com organization_id novo
    if (!profileOrgId) setTimeout(() => window.location.reload(), 600);
    return data as string;
  };

  return { orgs, loading, activeOrgId, switchOrg, createOrg, reload: load };
}
