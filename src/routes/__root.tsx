import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { KeyboardHelp } from "@/components/layout/KeyboardHelp";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ConectaCRM — CRM para WhatsApp e Instagram" },
      { name: "description", content: "CRM completo para gerenciar leads, atendimentos, funil de vendas e automações com WhatsApp e Instagram." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "ConectaCRM — CRM para WhatsApp e Instagram" },
      { property: "og:description", content: "CRM completo para gerenciar leads, atendimentos, funil de vendas e automações com WhatsApp e Instagram." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "theme-color", content: "#3b82f6" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "ConectaCRM" },
      { name: "twitter:title", content: "ConectaCRM — CRM para WhatsApp e Instagram" },
      { name: "twitter:description", content: "CRM completo para gerenciar leads, atendimentos, funil de vendas e automações com WhatsApp e Instagram." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7325eced-10f6-49ff-aeed-0d78576367dd/id-preview-6b89dfeb--98d49989-1fe8-4c57-8601-17907d783829.lovable.app-1778695669997.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7325eced-10f6-49ff-aeed-0d78576367dd/id-preview-6b89dfeb--98d49989-1fe8-4c57-8601-17907d783829.lovable.app-1778695669997.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
          <PwaInstallPrompt />
          <CookieConsent />
          <CommandPalette />
          <KeyboardHelp />
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
