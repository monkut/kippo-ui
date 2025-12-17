import type { Config } from "@react-router/dev/config";

// URL_PREFIX is used for deployments with a stage prefix (e.g., /prod)
// Set VITE_URL_PREFIX environment variable when building for production
const urlPrefix = process.env.VITE_URL_PREFIX || "";

export default {
  ssr: false,
  basename: `${urlPrefix}/ui/`,
} satisfies Config;
