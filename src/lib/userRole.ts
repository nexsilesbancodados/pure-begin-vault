// Resolve o cargo do usuário para escolher o layout do dashboard.
import { useAuth } from "@/contexts/AuthContext";

export type DashboardRole = "admin" | "vendedor" | "financeiro" | "tecnico";

const ADMIN_EMAILS = new Set([
  "alfatech791@gmail.com",
  "contato@focussdev.art",
]);

export function useDashboardRole(): DashboardRole {
  const { user, profile } = useAuth();
  const email = (user?.email ?? "").toLowerCase();
  if (ADMIN_EMAILS.has(email)) return "admin";

  const role = String(profile?.role ?? "").toLowerCase().trim();
  if (["super_admin", "owner", "admin"].includes(role)) return "admin";
  if (role.includes("financ")) return "financeiro";
  if (role.includes("tec") || role.includes("suporte") || role.includes("os")) return "tecnico";
  if (role.includes("vend")) return "vendedor";
  return "vendedor";
}

export const ROLE_LABEL: Record<DashboardRole, string> = {
  admin: "Visão Executiva",
  vendedor: "Painel do Vendedor",
  financeiro: "Painel Financeiro",
  tecnico: "Painel Técnico",
};
