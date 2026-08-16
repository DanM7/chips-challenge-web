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
    include: [
      "apps/chips-challenge-web/test/**/*.test.ts",
      "packages/2d-tile-engine/test/**/*.test.ts",
    ],
    exclude: [
      "packages/2d-tile-engine/test/integration/**",
      "packages/2d-tile-engine/test/level001TwsDebug.test.ts",
      "packages/2d-tile-engine/test/level001DatParity.test.ts",
      "packages/2d-tile-engine/test/level001MapDump.test.ts",
      "packages/2d-tile-engine/test/level002Manual.test.ts",
      "packages/2d-tile-engine/test/level002BlockPush.test.ts",
      "packages/2d-tile-engine/test/level002FromPrefix.test.ts",
      "packages/2d-tile-engine/test/level003Solution.test.ts",
      "packages/2d-tile-engine/test/level004Solution.test.ts",
    ],
    testTimeout: 60_000,
  },
  publicDir: path.join(APP_ROOT, "public"),
});
