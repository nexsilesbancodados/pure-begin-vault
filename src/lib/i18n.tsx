import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Locale = "pt" | "en" | "es";

const dict: Record<Locale, Record<string, string>> = {
  pt: {
    "nav.dashboard": "Dashboard",
    "nav.reports": "Relatórios",
    "nav.calendar": "Calendário",
    "nav.nps": "NPS",
    "nav.templates": "Modelos de Mensagem",
    "nav.inbox": "Inbox unificada",
    "common.save": "Salvar",
    "common.cancel": "Cancelar",
    "common.create": "Criar",
    "common.delete": "Excluir",
    "common.edit": "Editar",
    "common.search": "Buscar",
    "common.loading": "Carregando...",
    "common.empty": "Sem dados",
    "lang.label": "Idioma",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.reports": "Reports",
    "nav.calendar": "Calendar",
    "nav.nps": "NPS",
    "nav.templates": "Message Templates",
    "nav.inbox": "Unified inbox",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.create": "Create",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.search": "Search",
    "common.loading": "Loading...",
    "common.empty": "No data",
    "lang.label": "Language",
  },
  es: {
    "nav.dashboard": "Panel",
    "nav.reports": "Informes",
    "nav.calendar": "Calendario",
    "nav.nps": "NPS",
    "nav.templates": "Plantillas de Mensaje",
    "nav.inbox": "Bandeja unificada",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.create": "Crear",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.search": "Buscar",
    "common.loading": "Cargando...",
    "common.empty": "Sin datos",
    "lang.label": "Idioma",
  },
};

type Ctx = { locale: Locale; setLocale: (l: Locale) => void; t: (k: string) => string };
const I18nContext = createContext<Ctx>({ locale: "pt", setLocale: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => (localStorage.getItem("locale") as Locale) || "pt");
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const setLocale = (l: Locale) => { localStorage.setItem("locale", l); setLocaleState(l); };
  const t = (k: string) => dict[locale][k] ?? dict.pt[k] ?? k;
  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
