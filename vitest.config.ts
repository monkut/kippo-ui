import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    projects: [
      {
        plugins: [react(), tsconfigPaths()],
        test: {
          include: ["tests/**/*.unit.{test,spec}.{ts,tsx}"],
          name: "unit",
          environment: "node",
          // Pin the timezone so date-handling tests (#52) are reproducible
          // regardless of the developer's machine.
          env: { TZ: "Asia/Tokyo" },
        },
      },
      {
        // Tailwind is needed so browser tests that import `app/app.css` can
        // assert on real computed styles (e.g. sticky table headers).
        plugins: [tailwindcss(), react(), tsconfigPaths()],
        test: {
          include: ["tests/**/*.browser.{test,spec}.{ts,tsx}"],
          name: "browser",
          browser: {
            headless: true,
            enabled: true,
            provider: "playwright",
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
