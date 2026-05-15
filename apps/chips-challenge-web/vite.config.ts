import fs from "fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";

const VENDOR_MS = path.resolve("vendor/chips-challenge-ms");

function serveVendorAssets(urlPrefix: string, dir: string): Plugin {
  return {
    name: `serve-${urlPrefix}`,
    configureServer(server) {
      server.middlewares.use(urlPrefix, (req, res, next) => {
        if (!req.url) return next();
        const rel = decodeURIComponent(req.url.split("?")[0] ?? "");
        const filePath = path.join(dir, rel);
        if (!filePath.startsWith(dir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next();
        }
        const ext = path.extname(filePath).toLowerCase();
        const types: Record<string, string> = {
          ".png": "image/png",
          ".json": "application/json",
          ".wav": "audio/wav",
          ".mid": "audio/midi",
        };
        res.setHeader("Content-Type", types[ext] ?? "application/octet-stream");
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: [".", "vendor"],
    },
  },
  build: {
    target: "es2022",
  },
  plugins: [
    serveVendorAssets("/ms-assets", path.join(VENDOR_MS, "generated")),
    serveVendorAssets("/ms-audio", VENDOR_MS),
    {
      name: "copy-ms-assets-to-dist",
      closeBundle() {
        const generated = path.join(VENDOR_MS, "generated");
        const assetsOut = path.resolve("dist", "ms-assets");
        if (fs.existsSync(generated)) {
          fs.mkdirSync(assetsOut, { recursive: true });
          for (const name of fs.readdirSync(generated)) {
            fs.copyFileSync(path.join(generated, name), path.join(assetsOut, name));
          }
        }
        const audioOut = path.resolve("dist", "ms-audio");
        if (fs.existsSync(VENDOR_MS)) {
          fs.mkdirSync(audioOut, { recursive: true });
          for (const name of fs.readdirSync(VENDOR_MS)) {
            if (/\.(wav|mid)$/i.test(name)) {
              fs.copyFileSync(path.join(VENDOR_MS, name), path.join(audioOut, name));
            }
          }
        }
      },
    },
  ],
});
