import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Matches the source app's choice (see its vite.config.ts): same API surface as jsdom
    // for what these components need, considerably faster to start.
    environment: "happy-dom",
    globals: false,
    // tools/ carries its own `bun test` suites.
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test-setup.ts"],
  },
});
