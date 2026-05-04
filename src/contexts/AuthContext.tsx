import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

 export type Role = "super_admin" | "owner" | "admin" | "financeiro" | "vendedor" | "employee" | "user";

import { AppPermissions, DEFAULT_ADMIN_PERMISSIONS, DEFAULT_EMPLOYEE_PERMISSIONS } from "@/types/permissions";

export type { AppPermissions as UserPermissions };

 interface AuthContextType {
   session: any;
   user: User | null;
   profile: any;
   permissions: AppPermissions | null;
   loading: boolean;
   logout: () => Promise<void>;
 }

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [permissions, setPermissions] = useState<AppPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (data) {
      setProfile(data);
      // Atribuir permissões baseadas no cargo
      if (data.role === 'super_admin' || data.role === 'owner' || data.role === 'admin') {
        setPermissions(DEFAULT_ADMIN_PERMISSIONS);
      } else if (data.role === 'financeiro') {
        setPermissions({ ...DEFAULT_EMPLOYEE_PERMISSIONS, financeiro: true, relatorios: true });
      } else if (data.role === 'vendedor') {
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
