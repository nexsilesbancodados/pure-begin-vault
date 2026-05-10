import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

let cachedOrgId: string | null = null;
let cachedFor: string | null = null;

export async function getOrgId(userId: string): Promise<string | null> {
  if (cachedOrgId && cachedFor === userId) return cachedOrgId;
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  cachedOrgId = data?.organization_id ?? null;
  cachedFor = userId;
  return cachedOrgId;
}

export function useOrg() {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(cachedOrgId);
  const [loading, setLoading] = useState(!cachedOrgId);
  useEffect(() => {
    if (!user?.id) { setOrgId(null); setLoading(false); return; }
    let cancel = false;
    setLoading(true);
    getOrgId(user.id).then((id) => {
      if (!cancel) { setOrgId(id); setLoading(false); }
    });
    return () => { cancel = true; };
  }, [user?.id]);
  return { orgId, loading, userId: user?.id ?? null };
}
