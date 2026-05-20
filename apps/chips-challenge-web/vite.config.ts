import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
// @ts-expect-error — runtime .mjs helper used by npm scripts
import { getGeneratedDir, getInstallDir, resolveInstallFile } from "./scripts/cc1Paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(__dirname, "../../../2d-tile-engine");

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".json") return "application/json";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mid" || ext === ".midi") return "audio/midi";
  return "application/octet-stream";
}

function serveFromDir(
  rootDir: string,
  urlPath: string,
  res: import("http").ServerResponse,
  next: () => void,
  matchCaseInsensitive = false,
) {
  const rel = decodeURIComponent(urlPath.split("?")[0] ?? "").replace(/^\//, "");
  if (!rel || rel.includes("..")) return next();
  const base = path.resolve(rootDir);
  const direct = path.join(base, rel);
  if (direct.startsWith(base) && fs.existsSync(direct) && fs.statSync(direct).isFile()) {
    res.setHeader("Content-Type", contentTypeFor(direct));
    fs.createReadStream(direct).pipe(res);
    return;
  }
  if (matchCaseInsensitive) {
    const leaf = path.basename(rel);
    const hit = resolveInstallFile(leaf);
    if (hit?.startsWith(base)) {
      res.setHeader("Content-Type", contentTypeFor(hit));
      fs.createReadStream(hit).pipe(res);
      return;
    }
  }
  next();
}

export default defineConfig({
  root: __dirname,
  publicDir: path.join(__dirname, "public"),
  resolve: {
    alias: {
      "@engine": path.join(ENGINE_ROOT, "engine"),
      "@tile-engine": path.join(ENGINE_ROOT, "tile-engine"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    open: "/",
    fs: {
      allow: [__dirname, ENGINE_ROOT, getInstallDir(), getGeneratedDir()],
    },
  },
  build: {
    target: "es2022",
    outDir: path.join(__dirname, "dist"),
    emptyOutDir: true,
  },
  plugins: [
    {
      name: "optional-vendor-ms-assets",
      configureServer(server) {
        const generated = getGeneratedDir();
        const install = getInstallDir();
        fs.mkdirSync(generated, { recursive: true });

        server.middlewares.use("/ms-assets", (req, res, next) => {
          if (!req.url) return next();
          serveFromDir(generated, req.url, res, next);
        });

        server.middlewares.use("/ms-audio", (req, res, next) => {
          if (!req.url) return next();
          serveFromDir(install, req.url, res, next, true);
        });
      },
    },
  ],
});
