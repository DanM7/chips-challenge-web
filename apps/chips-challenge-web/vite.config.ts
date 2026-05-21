import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, type Plugin } from "vite";
import { getGamePackDir, getGeneratedDir, getInstallDir, resolveInstallFile } from "./scripts/cc1Paths.mjs";
import { getEngineRoot } from "./scripts/engineRoot.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = getEngineRoot();

const MS_TILES_PNG = getGamePackDir("sprites", "ms-tiles.png");
const MS_TILES_JSON = getGamePackDir("sprites", "ms-tiles.json");
const MS_TILES_URL = "/games/chips-challenge-1/sprites/ms-tiles.png";
const MS_TILES_JSON_URL = "/games/chips-challenge-1/sprites/ms-tiles.json";
const MS_AUDIO_PREFIX = "/games/chips-challenge-1/audio/";

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".json") return "application/json";
  if (ext === ".wav") return "audio/wav";
  return "application/octet-stream";
}

function sendFile(filePath: string, res: import("http").ServerResponse): void {
  res.setHeader("Content-Type", contentTypeFor(filePath));
  fs.createReadStream(filePath).pipe(res);
}

/**
 * Dev/preview fallback: serve MS tiles and audio from vendor/install when not committed in the game pack.
 */
function msPackDevFallbackPlugin(): Plugin {
  return {
    name: "ms-pack-dev-fallback",
    configureServer(server) {
      attachDevFallback(server.middlewares);
    },
    configurePreviewServer(server) {
      attachDevFallback(server.middlewares);
    },
  };
}

function attachDevFallback(middlewares: {
  use: (
    handler: (
      req: import("http").IncomingMessage,
      res: import("http").ServerResponse,
      next: () => void,
    ) => void,
  ) => void;
}): void {
  middlewares.use((req, res, next) => {
    const url = decodeURIComponent(req.url?.split("?")[0] ?? "");
    if (!url) return next();

    if (url === MS_TILES_URL && !fs.existsSync(MS_TILES_PNG)) {
      const vendor = path.join(getGeneratedDir(), "tiles.png");
      if (fs.existsSync(vendor)) {
        sendFile(vendor, res);
        return;
      }
    }
    if (url === MS_TILES_JSON_URL && !fs.existsSync(MS_TILES_JSON)) {
      const vendor = path.join(getGeneratedDir(), "tiles.json");
      if (fs.existsSync(vendor)) {
        sendFile(vendor, res);
        return;
      }
    }
    if (url.startsWith(MS_AUDIO_PREFIX)) {
      const leaf = path.basename(url);
      const committed = path.join(getGamePackDir("audio"), leaf);
      if (!fs.existsSync(committed)) {
        const hit = resolveInstallFile(leaf);
        if (hit) {
          sendFile(hit, res);
          return;
        }
      }
    }
    next();
  });
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
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: "es2022",
    outDir: path.join(__dirname, "dist"),
    emptyOutDir: true,
  },
  plugins: [msPackDevFallbackPlugin()],
});
