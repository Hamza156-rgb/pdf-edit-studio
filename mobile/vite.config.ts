import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

const clientSrc = path.resolve(import.meta.dirname, "../client/src");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  if (mode === "production" && /your-domain/.test(env.VITE_API_BASE_URL ?? "")) {
    console.warn("\n⚠  VITE_API_BASE_URL still points at the placeholder in .env.production — set your real API URL before releasing.\n");
  }
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      // Reuse the website's editor, UI kit, and API client from ../client.
      alias: {
        "@": clientSrc,
        "@shared": path.resolve(import.meta.dirname, "../shared"),
      },
      // Shared code lives outside this package; make every import resolve to one copy of these
      // libraries so React context (React Query, tRPC, router) works across both trees.
      dedupe: ["react", "react-dom", "@tanstack/react-query", "@trpc/client", "@trpc/react-query", "wouter", "sonner", "superjson"],
    },
    server: {
      port: 5180, // 5173 is often taken by other Vite projects on the same machine
      fs: { allow: [".."] },
      // Browser preview: talk to the website's dev server (`pnpm dev` in the repo root).
      proxy: { "/api": { target: env.API_PROXY_TARGET || "http://localhost:3000", changeOrigin: true } },
    },
    build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  };
});
