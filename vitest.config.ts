import path from "path";
import { defineConfig } from "vitest/config";

import { getEngineRoot } from "./apps/chips-challenge-web/scripts/engineRoot.mjs";

const ENGINE_ROOT = getEngineRoot();
const APP_ROOT = path.resolve(__dirname, "apps/chips-challenge-web");

export default defineConfig({
  resolve: {
    alias: {
      "@engine": path.join(ENGINE_ROOT, "engine"),
      "@tile-engine": path.join(ENGINE_ROOT, "tile-engine"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "apps/chips-challenge-web/test/**/*.test.ts"],
  },
  publicDir: path.join(APP_ROOT, "public"),
});
