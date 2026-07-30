import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import {
  resolveDefaultLaunchLevelNumber,
  resolveLevelNumberFromPassword,
} from "@engine/levelPassword.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packRoot = path.join(__dirname, "../public/games/chips-challenge-1");

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(packRoot, relativePath), "utf8"),
  ) as T;
}

describe("chips-challenge-1 game pack", () => {
  it("manifest and levels index are consistent", () => {
    const manifest = readJson<{ id: string; levelsIndexUrl: string }>("manifest.json");
    expect(manifest.id).toBe("chips-challenge-1");

    const index = readJson<{ levels: { id: string; url: string }[] }>("levels/index.json");
    expect(index.levels.length).toBeGreaterThanOrEqual(8);
    for (const entry of index.levels) {
      expect(entry.url).toMatch(/^\/games\/chips-challenge-1\/levels\/level-\d{3}\.json$/);
    }

    const defaultLevel = resolveDefaultLaunchLevelNumber(index);
    expect(defaultLevel).toBe(5);
    expect(index.defaultLevelId).toBe("level-005");
  });

  it("level-001 uses compact layers and ruleset ids", () => {
    const level = readJson<{
      ruleset?: string;
      contentPack?: string;
      layers: { lower: { emptyPrefix: number }; upper: { tiles: string[] } };
    }>("levels/level-001.json");
    expect(level.ruleset).toBe("grid-arcade-v1");
    expect(level.contentPack).toBe("ms-cc1");
    expect(level.layers.lower).toHaveProperty("emptyPrefix");
    expect(Array.isArray(level.layers.upper.tiles)).toBe(true);
  });

  it("assets.json points at game-pack MS tiles and audio", () => {
    const assets = readJson<{
      spritesheets: { ms_tiles: { url: string; frameWidth: number } };
      audio: Record<string, string>;
    }>("assets.json");
    expect(assets.spritesheets.ms_tiles.url).toBe(
      "/games/chips-challenge-1/sprites/ms-tiles.png",
    );
    expect(assets.spritesheets.ms_tiles.frameWidth).toBe(32);
    expect(assets.audio.blip).toMatch(
      /^\/games\/chips-challenge-1\/audio\/[A-Z0-9_]+\.WAV$/,
    );
  });

  it("ruleset and content pack documents align", () => {
    const ruleset = readJson<{ id: string }>("rulesets/grid-arcade-v1.json");
    const pack = readJson<{ ruleset: string; tiles: Record<string, unknown> }>(
      "content/ms-cc1.json",
    );
    expect(ruleset.id).toBe("grid-arcade-v1");
    expect(pack.ruleset).toBe("grid-arcade-v1");
    expect(pack.tiles.exit).toBeDefined();
    expect(pack.tiles.key_blue).toBeDefined();
  });

  it("resolves MS passwords from original-level-reference", () => {
    const ref = readJson<{ levels: { number: number; passwordMs: string }[] }>(
      "data/original-level-reference.json",
    );
    const lesson1 = ref.levels.find((l) => l.number === 1);
    expect(lesson1?.passwordMs).toBeTruthy();
    const resolved = resolveLevelNumberFromPassword(ref, lesson1!.passwordMs);
    expect(resolved).toBe(1);
  });
});
