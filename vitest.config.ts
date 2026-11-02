import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Valores públicos (a chave publishable é pública por desenho); evita depender do .env local.
    env: {
      VITE_SUPABASE_URL: process.env["VITE_SUPABASE_URL"] ?? "https://jfdsqcasoeqrqhbtqkpw.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "sb_publishable_oDzgy_HN9tuT3fE0UVl53w_saClfZOj",
    },
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
