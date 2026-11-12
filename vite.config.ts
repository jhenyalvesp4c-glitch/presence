import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import path from "node:path";

export default defineConfig(({ command }) => ({
  server: {
    host: true,
    port: 8080,
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    // Nitro produces the deployable server bundle. The preset defaults to Node
    // (`node .output/server/index.mjs`); override with NITRO_PRESET (e.g. vercel,
    // netlify, cloudflare-module) or pass `{ preset: "..." }` here.
    // A Central de entrada chama a IA (leitura de prints e PDFs) e pode levar dezenas de segundos: na Vercel a
    // função do servidor precisa de mais tempo que os 10 s padrão (60 s é o teto do plano gratuito).
    ...(command === "build" ? [nitro({ vercel: { functions: { maxDuration: 60 } } })] : []),
    viteReact(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
}));
