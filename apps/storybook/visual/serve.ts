/** Serve `storybook-static/` for the visual tests (build it first: `bun run build`). */

import { join, normalize } from "node:path";

const ROOT = join(import.meta.dir, "..", "storybook-static");

Bun.serve({
  hostname: "127.0.0.1",
  port: 6007,
  async fetch(request) {
    const path = normalize(decodeURIComponent(new URL(request.url).pathname)).replace(/^(\.\.[/\\])+/, "");
    const file = Bun.file(join(ROOT, path.endsWith("/") ? `${path}index.html` : path));
    return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
  },
});
