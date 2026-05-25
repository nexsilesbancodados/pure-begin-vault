// Mapeia a "Tela inicial após login" escolhida no cadastro do usuário
// para a rota correspondente. Persistido em localStorage por email para que
// o redirecionamento aconteça sem depender do banco.

const KEY = "user_home_screen_by_email";

export const HOME_SCREEN_ROUTES: Record<string, string> = {
  "Painel Inicial": "/painel",
  "Vendas": "/vendas",
  "PDV": "/pdv",
  "Estoque": "/estoque/atual",
  "Ordens de Serviço": "/servicos",
  "Financeiro": "/financeiro",
  "CRM": "/crm",
};

function readMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function setHomeScreenForEmail(email: string, screen: string) {
  if (!email) return;
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

export function getHomeScreenFromUser(user?: {
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
} | null): string | null {
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
  let screen = map[key];
  // Fallback: varre invite_meta_* legados procurando o email
  if (!screen) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("invite_meta_")) continue;
        const data = JSON.parse(localStorage.getItem(k) || "{}");
        for (const v of Object.values<any>(data)) {
          if (v?.tela_inicial && v?.email && String(v.email).toLowerCase() === key) {
            screen = v.tela_inicial;
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
