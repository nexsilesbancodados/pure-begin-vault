// Mapeia a "Tela inicial após login" escolhida no cadastro do usuário
// para a rota correspondente. A fonte principal é o user_metadata do Supabase;
// o localStorage fica apenas como compatibilidade para cadastros antigos.

const KEY = "user_home_screen_by_email";

export const HOME_SCREEN_ROUTES: Record<string, string> = {
  "Painel Inicial": "/painel",
  Vendas: "/vendas",
  PDV: "/pdv",
  Estoque: "/estoque/atual",
  "Ordens de Serviço": "/servicos",
  Financeiro: "/financeiro",
  CRM: "/crm",
};

const LEGACY_HOME_SCREEN_BY_EMAIL: Record<string, string> = {
  "rafael.premier@gmail.com": "PDV",
};

function readMap(): Record<string, string> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function setHomeScreenForEmail(email: string, screen: string) {
  if (!email) return;
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const map = readMap();
    const key = email.trim().toLowerCase();
    if (screen) map[key] = screen;
    else delete map[key];
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function getHomeRoute(screen?: string | null): string {
  const normalized = typeof screen === "string" ? screen.trim() : "";
  return (normalized && HOME_SCREEN_ROUTES[normalized]) || "/painel";
}

export function getHomeScreenFromUser(
  user?: {
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
  } | null,
): string | null {
  const metadataSources = [user?.user_metadata, user?.app_metadata];

  for (const metadata of metadataSources) {
    const screen = metadata?.tela_inicial;
    if (typeof screen === "string" && screen.trim()) {
      return screen.trim();
    }
  }

  return null;
}

export function getHomeRouteForEmail(email?: string | null): string {
  if (!email) return "/painel";
  const key = email.trim().toLowerCase();
  const map = readMap();
  let screen = map[key] ?? LEGACY_HOME_SCREEN_BY_EMAIL[key];
  // Fallback: varre invite_meta_* legados procurando o email
  if (!screen && typeof window !== "undefined" && window.localStorage) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("invite_meta_")) continue;
        const data = JSON.parse(localStorage.getItem(k) || "{}") as Record<string, unknown>;
        for (const value of Object.values(data)) {
          const inviteMeta = value as { tela_inicial?: unknown; email?: unknown };
          if (
            typeof inviteMeta.tela_inicial === "string" &&
            inviteMeta.tela_inicial.trim() &&
            typeof inviteMeta.email === "string" &&
            inviteMeta.email.toLowerCase() === key
          ) {
            screen = inviteMeta.tela_inicial;
            break;
          }
        }
        if (screen) break;
      }
    } catch {
      /* ignore */
    }
  }
  return getHomeRoute(screen);
}
