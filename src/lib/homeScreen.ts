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

const MENU_ALIASES: Record<string, string[]> = {
  "Painel Inicial": ["Dashboard", "Painel inicial", "Tela inicial"],
  Dashboard: ["Painel Inicial", "Tela inicial"],
  Vendas: ["Vendas & PDV", "Vendas"],
  PDV: ["Vendas & PDV", "Frente de Caixa (PDV)", "PDV"],
  Estoque: ["Estoque", "Estoque Atual"],
  "Ordens de Serviço": ["Serviços & OS", "Dashboard OS", "Nova Ordem"],
  Financeiro: ["Financeiro", "Notas em Aberto", "DRE Gerencial"],
  CRM: ["CRM", "Atendimento & CRM"],
  Sistema: ["Sistema / Parametrização", "Parametrização"],
  Parametrização: ["Sistema / Parametrização", "Sistema"],
  "Integrações externas": ["Integrações"],
  "Cupons Fiscais": ["Notas Fiscais"],
  Notas: ["Notas em Aberto", "Notas Fiscais"],
  "Notas Fiscais": ["Notas em Aberto"],
  "Config. (Pix/PIN/Comissão)": ["Loja", "Configurações da Loja"],
  "Minhas Lojas": ["Loja"],
  "Programa de Afiliados": ["Afiliados"],
  "Central de Ajuda": ["Ajuda"],
};

const FALLBACK_HOME_BY_MENU = [
  "PDV",
  "Vendas",
  "Estoque",
  "Ordens de Serviço",
  "Financeiro",
  "CRM",
  "Painel Inicial",
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeEmail(email?: string | null) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function getEmailFromUser(user?: { email?: string | null } | null) {
  return normalizeEmail(user?.email);
}

function isForcedLegacyUser(user?: { email?: string | null } | null, email?: string | null) {
  const key = getEmailFromUser(user) || normalizeEmail(email);
  return !!key && !!LEGACY_HOME_SCREEN_BY_EMAIL[key];
}

function getForcedHomeScreen(user?: { email?: string | null } | null, email?: string | null) {
  const key = getEmailFromUser(user) || normalizeEmail(email);
  return key ? LEGACY_HOME_SCREEN_BY_EMAIL[key] : undefined;
}

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

export function isMenuAllowed(title: string, allowed?: unknown): boolean {
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  const allowedSet = new Set(
    allowed
      .filter((value): value is string => typeof value === "string")
      .map((value) => normalize(value)),
  );
  if (allowedSet.size === 0) return true;
  if (allowedSet.has(normalize(title))) return true;
  return (MENU_ALIASES[title] ?? []).some((alias) => allowedSet.has(normalize(alias)));
}

export function getAllowedMenuFromUser(
  user?: {
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
  } | null,
): string[] | null {
  const allowed = user?.user_metadata?.allowed_menu ?? user?.app_metadata?.allowed_menu;
  return Array.isArray(allowed) ? allowed.filter((value): value is string => typeof value === "string") : null;
}

export function getHomeRouteForUser(
  user?: {
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
  } | null,
  fallbackEmail?: string | null,
): string {
  const forced = getForcedHomeScreen(user, fallbackEmail);
  if (forced) return getHomeRoute(forced);

  const selectedScreen = getHomeScreenFromUser(user) ?? undefined;
  const allowedMenu = getAllowedMenuFromUser(user);
  if (selectedScreen && isMenuAllowed(selectedScreen, allowedMenu)) {
    return getHomeRoute(selectedScreen);
  }

  const fallbackScreen = FALLBACK_HOME_BY_MENU.find((screen) => isMenuAllowed(screen, allowedMenu));
  if (fallbackScreen) return getHomeRoute(fallbackScreen);

  return getHomeRouteForEmail(fallbackEmail ?? user?.email ?? null);
}

export function getHomeScreenFromUser(
  user?: {
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
  } | null,
): string | null {
  if (isForcedLegacyUser(user)) return getForcedHomeScreen(user) ?? null;
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
