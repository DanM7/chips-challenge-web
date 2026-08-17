import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { replayTwsRecords, type TwsTickMove } from "../engine/twsReplay.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import type { LevelData } from "../engine/types.js";

const packLevels = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);

function loadLevel(file: string): LevelData {
  const raw = JSON.parse(readFileSync(path.join(packLevels, file), "utf8")) as LevelData;
  normalizeLevelLayers(raw);
  return raw;
}

describe("TWS tick slides (Ping Pong)", () => {
  it("first down steps onto force_s instead of riding the whole strip", () => {
    const recs = readLevelSolution<{ twsRecords: TwsTickMove[] }>(28)?.twsRecords ?? [];
    const r = replayTwsRecords(structuredClone(loadLevel("level-028.json")), recs.slice(0, 1));
    expect(r.playerDied).toBe(false);
    expect(r.finalPosition).toEqual({ x: 1, y: 2 });
  });
});

describe("TWS tick slides (Forced Entry)", () => {
  it("first right steps onto force_e instead of riding the maze", () => {
    const recs = readLevelSolution<{ twsRecords: TwsTickMove[] }>(22)?.twsRecords ?? [];
    const r = replayTwsRecords(structuredClone(loadLevel("level-022.json")), recs.slice(0, 1));
    expect(r.playerDied).toBe(false);
    expect(r.finalPosition).toEqual({ x: 2, y: 1 });
  });
});

describe("TWS tick slides (Knot)", () => {
  it("full TWS records complete the level", () => {
    const recs = readLevelSolution<{ twsRecords: TwsTickMove[] }>(31)?.twsRecords ?? [];
    const r = replayTwsRecords(structuredClone(loadLevel("level-031.json")), recs);
    expect(r.playerDied, r.deathMessage).toBe(false);
    expect(r.completed).toBe(true);
  });
});
