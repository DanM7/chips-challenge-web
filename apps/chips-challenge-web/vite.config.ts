import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(__dirname, "../../../2d-tile-engine");

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
    port: 5173,
    open: true,
    fs: {
      allow: [__dirname, ENGINE_ROOT],
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
        const vendor = path.resolve(__dirname, "vendor/chips-challenge-ms");
        if (!fs.existsSync(vendor)) return;
        server.middlewares.use("/ms-assets", (req, res, next) => {
          if (!req.url) return next();
          const rel = decodeURIComponent(req.url.split("?")[0] ?? "");
          const filePath = path.join(vendor, "generated", rel);
          if (!filePath.startsWith(path.join(vendor, "generated")) || !fs.existsSync(filePath)) {
            return next();
          }
          res.setHeader("Content-Type", "image/png");
          fs.createReadStream(filePath).pipe(res);
        });
      },
    },
  ],
});
