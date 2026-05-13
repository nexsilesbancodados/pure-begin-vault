// Hook leve de monitoring que funciona com ou sem Sentry.
// Se setar VITE_SENTRY_DSN no env, carrega Sentry browser SDK via CDN.
// Caso contrário, só loga no console.

declare global {
  interface Window {
    Sentry?: {
      init: (cfg: any) => void;
      captureException: (e: any) => void;
      captureMessage: (m: string, level?: string) => void;
      setUser: (u: any) => void;
    };
  }
}

const DSN = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
let initialized = false;

export function initMonitoring() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if (!DSN) {
    // Modo dev/sem-Sentry: só override console.error pra log estruturado
    return;
  }

  // Lazy load Sentry CDN
  const s = document.createElement("script");
  s.src = "https://browser.sentry-cdn.com/7.110.0/bundle.tracing.min.js";
  s.crossOrigin = "anonymous";
  s.onload = () => {
    if (window.Sentry) {
      window.Sentry.init({
        dsn: DSN,
        environment: window.location.hostname.includes("conectaphone.com")
          ? "production"
          : "staging",
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.1,
      });
    }
  };
  document.head.appendChild(s);
}

export function captureError(e: any, context?: Record<string, any>) {
  if (typeof window !== "undefined" && window.Sentry) {
    window.Sentry.captureException(e);
  }
  console.error("[monitor]", e, context);
}

export function captureMessage(msg: string, level: "info" | "warning" | "error" = "info") {
  if (typeof window !== "undefined" && window.Sentry) {
    window.Sentry.captureMessage(msg, level);
  }
  console[level === "error" ? "error" : level === "warning" ? "warn" : "log"]("[monitor]", msg);
}

export function setUserContext(user: { id: string; email?: string } | null) {
  if (typeof window !== "undefined" && window.Sentry) {
    window.Sentry.setUser(user);
  }
}
