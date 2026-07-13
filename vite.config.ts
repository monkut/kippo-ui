import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// URL_PREFIX is used for deployments with a stage prefix (e.g., /prod)
// Set VITE_URL_PREFIX environment variable when building for production
const urlPrefix = process.env.VITE_URL_PREFIX || "";

// Vite `base` = where built assets are served from: `/static/ui/` in production (Django serves the
// bundle from STATIC_ROOT). `react-router dev` additionally requires the router basename (`/ui/`,
// see react-router.config.ts) to *begin with* `base`, which `/static/ui/` does not — so `pnpm dev`
// won't boot with the production value. To run the local dev server, set VITE_DEV_BASE=/ui/ to
// align base with the basename. Production/CI leave it unset and keep `/static/ui/`.
const base = process.env.VITE_DEV_BASE || `${urlPrefix}/static/ui/`;

export default defineConfig({
  base,
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
