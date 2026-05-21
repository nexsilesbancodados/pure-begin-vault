import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
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
  login: (email: string, password: string) => Promise<{ session: Session; user: User }>;
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
    refreshAuthenticatedState().catch(() => {
      setSession(null);
      setUser(null);
      setProfile(null);
      setPermissions(null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      window.setTimeout(() => {
        refreshAuthenticatedState(session).catch(() => setLoading(false));
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function refreshAuthenticatedState(nextSession?: Session | null) {
    setLoading(true);
    const resolvedSession =
      nextSession === undefined
        ? (await supabase.auth.getSession()).data.session
        : nextSession;

    setSession(resolvedSession);

    if (!resolvedSession?.user) {
      setUser(null);
      setProfile(null);
      setPermissions(null);
      setLoading(false);
      return;
    }

    let resolvedUser = resolvedSession.user;
    try {
      const { data: fresh, error } = await supabase.auth.getUser();
      if (!error && fresh.user) resolvedUser = fresh.user;
    } catch (error) {
      console.warn("Não foi possível atualizar o usuário autenticado:", error);
    }

    setUser(resolvedUser);
    await fetchProfile(resolvedUser.id);
    setLoading(false);
  }

  async function fetchProfile(userId: string) {
    const profileResult = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    let { data } = profileResult;

    if (profileResult.error) {
      console.warn("Não foi possível carregar o perfil autenticado:", profileResult.error);
      setProfile(null);
      setPermissions(null);
      return;
    }

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

    if (!data) {
      setProfile(null);
      setPermissions(null);
      return;
    }

    setProfile(data);
    const role = String(data.role ?? "")
      .trim()
      .toLowerCase();
    // Atribuir permissões baseadas no cargo
    if (role === "super_admin" || 
        role === "owner" || 
        role === "admin" || 
        data.email === "alfatech791@gmail.com" || 
        data.email === "contato@focussdev.art") {
      setPermissions(DEFAULT_ADMIN_PERMISSIONS);
    } else if (role.includes("financeiro")) {
      setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS, financeiro: true, relatorios: true });
    } else if (role.includes("vendedor")) {
      setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS, vendas: true, pdv: true, crm: true });
    } else {
      setPermissions(DEFAULT_EMPLOYEE_PERMISSIONS);
    }
  }

  const login = async (email: string, password: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setLoading(false);
      throw error;
    }

    const activeSession = data.session ?? (await supabase.auth.getSession()).data.session;
    if (!activeSession) {
      setLoading(false);
      throw new Error("Login aceito, mas a sessão não foi criada.");
    }

    await refreshAuthenticatedState(activeSession);
    return { session: activeSession, user: activeSession.user };
  };

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
    <AuthContext.Provider value={{ session, user, profile, permissions, loading, login, logout }}>
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
