// Kill-switch Service Worker.
// Instalações antigas do ConectaCRM cacheavam bundles JS/CSS obsoletos,
// impedindo a exibição de novas funcionalidades (ex.: Curva ABC).
// Este SW se desregistra sozinho e apaga os caches criados pelas versões anteriores.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        // Só apaga caches criados por versões anteriores deste SW (prefixo ccrm-).
        await Promise.all(
          keys.filter((k) => k.startsWith("ccrm-")).map((k) => caches.delete(k)),
        );
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.all(
          clients.map((c) => {
            try {
              return c.navigate(c.url);
            } catch {
              return undefined;
            }
          }),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});

// Passa todos os fetches direto para a rede — sem cache.
self.addEventListener("fetch", () => {});
