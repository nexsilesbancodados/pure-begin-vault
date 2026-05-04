// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// On Vercel we don't want the Cloudflare Vite plugin (it targets Workers).
// Detect the Vercel build env and disable it so TanStack Start emits a
// standard Node/Edge-compatible build that we wrap with api/server.ts.
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  cloudflare: isVercel ? false : undefined,
});
