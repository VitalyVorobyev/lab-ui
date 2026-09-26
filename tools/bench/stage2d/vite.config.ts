import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Candidate (a) imports lab-ui from this repo's `src/`, whose bare imports would otherwise
  // resolve React from the repo root's node_modules — a second React, and broken hooks.
  resolve: { dedupe: ["react", "react-dom"] },
  build: { target: "es2022" },
  // Cross-origin isolation buys `performance.now()` its fine resolution (5 µs rather than
  // 100 µs) — the difference between measuring a hit-test and rounding it to zero.
  preview: { headers: { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" } },
  server: { headers: { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" } },
});
