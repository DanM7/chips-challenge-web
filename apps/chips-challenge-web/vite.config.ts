import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, type Plugin } from "vite";
import {
  getAppRoot,
  getGeneratedDir,
  getInstallDir,
  resolveInstallFile,
} from "./scripts/cc1Paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(__dirname, "../../../2d-tile-engine");

const AUDIO_LEAVES = [
  "BLIP2.WAV",
  "DOOR.WAV",
  "OOF3.WAV",
  "POP2.WAV",
  "WATER2.WAV",
  "TELEPORT.WAV",
  "BUMMER.WAV",
];

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

function resolveMsAssetDirs(): { tiles: string; audio: string } {
  const appRoot = getAppRoot();
  const publicAssets = path.join(appRoot, "public", "ms-assets");
  const publicAudio = path.join(appRoot, "public", "ms-audio");
  const bundledTiles = path.join(publicAssets, "tiles.png");
  return {
    tiles: fs.existsSync(bundledTiles) ? publicAssets : getGeneratedDir(),
    audio: fs.existsSync(publicAudio) && fs.readdirSync(publicAudio).length > 0
      ? publicAudio
      : getInstallDir(),
  };
}

function attachMsAssetMiddleware(middlewares: {
  use: (
    path: string,
    handler: (
      req: import("http").IncomingMessage,
      res: import("http").ServerResponse,
      next: () => void,
    ) => void,
  ) => void;
}): void {
  const { tiles, audio } = resolveMsAssetDirs();
  fs.mkdirSync(tiles, { recursive: true });

  middlewares.use("/ms-assets", (req, res, next) => {
    if (!req.url) return next();
    serveFromDir(tiles, req.url, res, next);
  });

  middlewares.use("/ms-audio", (req, res, next) => {
    if (!req.url) return next();
    const audioRoot = audio;
    serveFromDir(audioRoot, req.url, res, next, audioRoot === getInstallDir());
  });
}

/** Ensures dist/ms-assets and dist/ms-audio exist after build (backup if prebuild was skipped). */
function msDeployBundlePlugin(): Plugin {
  return {
    name: "ms-deploy-bundle",
    configureServer(server) {
      attachMsAssetMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMsAssetMiddleware(server.middlewares);
    },
    closeBundle() {
      const outDir = path.join(__dirname, "dist");
      const distAssets = path.join(outDir, "ms-assets");
      const distAudio = path.join(outDir, "ms-audio");
      const generated = getGeneratedDir();
      const tilesPng = path.join(generated, "tiles.png");
      const publicTiles = path.join(getAppRoot(), "public", "ms-assets", "tiles.png");

      const tilesSrc = fs.existsSync(publicTiles) ? publicTiles : tilesPng;
      if (!fs.existsSync(tilesSrc)) {
        console.warn(
          "[ms-deploy-bundle] tiles.png not in dist — run npm run ms:extract && npm run build",
        );
        return;
      }

      fs.mkdirSync(distAssets, { recursive: true });
      fs.copyFileSync(tilesSrc, path.join(distAssets, "tiles.png"));
      const tilesJsonSrc = tilesSrc.replace(/\.png$/i, ".json");
      if (fs.existsSync(tilesJsonSrc)) {
        fs.copyFileSync(tilesJsonSrc, path.join(distAssets, "tiles.json"));
      }

      const publicAudio = path.join(getAppRoot(), "public", "ms-audio");
      let copiedAudio = 0;
      fs.mkdirSync(distAudio, { recursive: true });
      for (const leaf of AUDIO_LEAVES) {
        const fromPublic = path.join(publicAudio, leaf);
        const src = fs.existsSync(fromPublic)
          ? fromPublic
          : resolveInstallFile(leaf);
        if (!src || !fs.existsSync(src)) continue;
        fs.copyFileSync(src, path.join(distAudio, path.basename(src)));
        copiedAudio++;
      }
      if (copiedAudio > 0) {
        console.log(`[ms-deploy-bundle] ${copiedAudio} audio file(s) in dist/ms-audio/`);
      }
    },
  };
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
  plugins: [msDeployBundlePlugin()],
});
