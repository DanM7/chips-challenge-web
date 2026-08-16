import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: [
      "test/integration/**",
      "test/level001TwsDebug.test.ts",
      "test/level001DatParity.test.ts",
      "test/level001MapDump.test.ts",
      "test/level002Manual.test.ts",
      "test/level002BlockPush.test.ts",
      "test/level002FromPrefix.test.ts",
      "test/level003Solution.test.ts",
      "test/level004Solution.test.ts",
    ],
    testTimeout: 60_000,
  },
});
