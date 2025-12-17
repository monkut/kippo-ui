import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// URL_PREFIX is used for deployments with a stage prefix (e.g., /prod)
// Set VITE_URL_PREFIX environment variable when building for production
const urlPrefix = process.env.VITE_URL_PREFIX || "";

export default defineConfig({
  base: `${urlPrefix}/static/ui/`,
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
});
