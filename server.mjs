import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./public", import.meta.url)));
const mime = new Map([
  [".html","text/html; charset=utf-8"],
  [".js","text/javascript; charset=utf-8"],
  [".json","application/json; charset=utf-8"],
  [".webp","image/webp"]
]);

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }

  if (pathname === "/healthz") {
    response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" }).end("ok\n");
    return;
  }

  const file = resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
  const type = mime.get(extname(file));
  if (!file.startsWith(root + sep) || !type) {
    response.writeHead(404).end();
    return;
  }

  let info;
  try {
    info = await stat(file);
  } catch {
    response.writeHead(404).end();
    return;
  }
  if (!info.isFile()) {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, {
    "Content-Type": type,
    "Content-Length": info.size,
    "Cache-Control": extname(file) === ".webp" ? "public, max-age=300" : "no-cache",
    "X-Content-Type-Options": "nosniff"
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(file);
  stream.on("error", () => response.destroy());
  response.on("close", () => stream.destroy());
  stream.pipe(response);
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log("Bounce Inferno listening on port " + port);
});
