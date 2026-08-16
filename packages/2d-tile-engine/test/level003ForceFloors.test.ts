import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import { tryMsCc1Move, msCc1StateFromRun } from "../engine/msCc1/msCc1Movement.js";
import type { LevelData } from "../engine/types.js";

const level003Path = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-003.json",
);

function loadLevel003(): LevelData {
  const raw = JSON.parse(readFileSync(level003Path, "utf8")) as LevelData;
  normalizeLevelLayers(raw);
  return raw;
}

describe("level 3 force floors", () => {
  it("down onto force_n overrides south (MS can walk against the arrow)", () => {
    const level = loadLevel003();
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(structuredClone(level), { x: 14, y: 17 }, "down", state);
    expect(r.moved).toBe(true);
    expect(r.position.y).toBeGreaterThan(17);
  });

  it("force-only slide from on force_n rides the arrow north", () => {
    const level = loadLevel003();
    const state = msCc1StateFromRun([], 0);
    const onto = tryMsCc1Move(structuredClone(level), { x: 14, y: 17 }, "down", state);
    expect(getForceFloorTileAt(level, onto.position.x, onto.position.y)).toBe("force_n");
    const ride = tryMsCc1Move(
      structuredClone(level),
      onto.position,
      "up",
      onto.state,
    );
    expect(ride.position.y).toBeLessThanOrEqual(onto.position.y);
  });

  it("down onto force_e at 17,18 leaves Chip on the east arrow pad", () => {
    const level = loadLevel003();
    const state = msCc1StateFromRun([], 0);
    const entry = tryMsCc1Move(structuredClone(level), { x: 17, y: 17 }, "down", state);
    expect(entry.position).toEqual({ x: 17, y: 18 });
    expect(getForceFloorTileAt(level, 17, 18)).toBe("force_e");
  });

  it("force-only east slide from on force_e 17,18 crosses the east strip", () => {
    const level = loadLevel003();
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(structuredClone(level), { x: 17, y: 18 }, "right", state);
    expect(r.moved).toBe(true);
    expect(r.position.x).toBeGreaterThanOrEqual(21);
  });
});
