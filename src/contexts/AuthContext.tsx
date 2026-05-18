import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

import {
  AppPermissions,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_EMPLOYEE_PERMISSIONS,
} from "@/types/permissions";

export type Role =
  | "super_admin"
  | "owner"
  | "admin"
  | "financeiro"
  | "vendedor"
  | "employee"
  | "user";

export type Profile = Tables<"profiles">;

export type { AppPermissions as UserPermissions };

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  permissions: AppPermissions | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<AppPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    let { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

    // Auto-ativa primeira loja se profile.organization_id está nulo
    // (caso comum: usuário recém-cadastrado por convite via create-team-user)
    if (data && !data.organization_id) {
      const { data: uo } = await (supabase as any)
        .from("user_organizations")
        .select("organization_id, is_default")
        .eq("user_id", userId)
        .order("is_default", { ascending: false });
      const firstOrg = (uo as any[])?.[0]?.organization_id;
      if (firstOrg) {
        const { error: swErr } = await (supabase as any).rpc("switch_organization", {
          _org_id: firstOrg,
        });
        if (!swErr) {
          const refetch = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();
          if (refetch.data) data = refetch.data;
        }
      }
    }

    if (data) {
      setProfile(data);
      const role = String(data.role ?? "")
        .trim()
        .toLowerCase();
      // Atribuir permissões baseadas no cargo
      if (role === "super_admin" || role === "owner" || role === "admin") {
        setPermissions(DEFAULT_ADMIN_PERMISSIONS);
      } else if (role.includes("financeiro")) {
        setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS, financeiro: true, relatorios: true });
      } else if (role.includes("vendedor")) {
        setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS, vendas: true, pdv: true, crm: true });
      } else {
        setPermissions(DEFAULT_EMPLOYEE_PERMISSIONS);
      }
    }
  }

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      // Limpar estados locais manualmente para garantir que a UI reflita a saída
      setSession(null);
      setUser(null);
      setProfile(null);
      setPermissions(null);
      // Forçar recarregamento se necessário, ou redirecionar via router
      window.location.href = "/login";
    } catch (error) {
      console.error("Erro ao sair:", error);
      // Mesmo com erro, tentamos limpar o estado
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, permissions, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
