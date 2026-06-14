// Servidor estático de la landing de Digital Impulso con Bun.
// Uso:  bun run start   (o)   bun --hot server.js   para recarga en caliente.

import { serve, file } from "bun";

const PORT = process.env.PORT || 3000;
const ROOT = import.meta.dir;

const server = serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = decodeURIComponent(url.pathname);

    // Ruta raíz -> index.html
    if (pathname === "/" || pathname === "") pathname = "/index.html";

    // Evitar path traversal: descartamos cualquier ".."
    if (pathname.includes("..")) {
      return new Response("400 Bad Request", { status: 400 });
    }

    const f = file(ROOT + pathname);
    if (await f.exists()) {
      // Bun infiere el Content-Type por la extensión del archivo.
      return new Response(f);
    }

    // cleanUrls: si no tiene extensión, probar agregando .html (igual que Vercel)
    if (!pathname.includes(".")) {
      const fh = file(ROOT + pathname.replace(/\/$/, "") + ".html");
      if (await fh.exists()) return new Response(fh);
    }

    return new Response("404 - No encontrado", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
});

console.log(`⚡ Digital Impulso corriendo en http://localhost:${server.port}`);
