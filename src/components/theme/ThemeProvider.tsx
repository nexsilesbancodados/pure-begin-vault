import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void };

const ThemeContext = createContext<Ctx>({ theme: "light", setTheme: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    try {
      const stored = (localStorage.getItem("theme") as Theme | null);
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const initial: Theme = stored ?? (prefersDark ? "dark" : "light");
      setThemeState(initial);
    } catch {}
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    try { localStorage.setItem("theme", theme); } catch {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, toggle: () => setThemeState(t => t === "dark" ? "light" : "dark") }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
