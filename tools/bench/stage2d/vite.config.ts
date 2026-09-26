import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Workspace packages resolve to their sources, so the bench measures the working tree.
  resolve: { conditions: ["@vitavision/source", ...defaultClientConditions], dedupe: ["react", "react-dom"] },
  build: { target: "es2022" },
  // Cross-origin isolation buys `performance.now()` its fine resolution (5 µs rather than
  // 100 µs) — the difference between measuring a hit-test and rounding it to zero.
  preview: { headers: { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" } },
  server: { headers: { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" } },
});
