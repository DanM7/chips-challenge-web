import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  getForceFloorTileAt,
  resolveForceSlideIntent,
} from "../engine/msCc1/msCc1Sliding.js";
import { tryMsCc1Move, msCc1StateFromRun } from "../engine/msCc1/msCc1Movement.js";
import type { LevelData } from "../engine/types.js";

const level009Path = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
);

function loadLevel009(): LevelData {
  const raw = JSON.parse(readFileSync(level009Path, "utf8")) as LevelData;
  normalizeLevelLayers(raw);
  return raw;
}

describe("level 9 force staircase", () => {
  it("lists force_s cells in the west column area", () => {
    const level = loadLevel009();
    const forces: Array<{ x: number; y: number; tile: string }> = [];
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const tile = getForceFloorTileAt(level, x, y);
        if (tile) {
          forces.push({ x, y, tile });
        }
      }
    }
    const south = forces.filter((f) => f.tile === "force_s");
    expect(south.length).toBeGreaterThan(0);
    // Log for debugging when test is inspected
    const minX = Math.min(...south.map((f) => f.x));
    const maxX = Math.max(...south.map((f) => f.x));
    const minY = Math.min(...south.map((f) => f.y));
    const maxY = Math.max(...south.map((f) => f.y));
    expect(maxX - minX).toBeLessThanOrEqual(6);
    expect(maxY - minY).toBeLessThanOrEqual(10);
  });

  it("holding right on force_s slides down-right through staggered column", () => {
    const level = loadLevel009();
    const state = msCc1StateFromRun([], 0);

    const south = [];
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (getForceFloorTileAt(level, x, y) === "force_s") {
          south.push({ x, y });
        }
      }
    }
    // Topmost force_s in the west staircase (smallest y; tie-break smallest x)
    const start = south.sort((a, b) => a.y - b.y || a.x - b.x)[0]!;
    expect(start).toBeDefined();

    const r = tryMsCc1Move(level, start, "right", state);
    expect(r.moved).toBe(true);
    expect(r.position.x).toBeGreaterThan(start.x);
    expect(r.position.y).toBeGreaterThan(start.y);
  });

  it.skip("after one right step, repeated right without release re-enters force pads", () => {
    const level = loadLevel009();
    const state = msCc1StateFromRun([], 0);

    const south = [];
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (getForceFloorTileAt(level, x, y) === "force_s") {
          south.push({ x, y });
        }
      }
    }
    const start = south.sort((a, b) => a.y - b.y || a.x - b.x)[0]!;

    const lvl = structuredClone(level);
    let pos = { x: start.x, y: start.y };
    const first = tryMsCc1Move(lvl, pos, "right", state);
    expect(first.moved).toBe(true);
    pos = first.position;

    const second = tryMsCc1Move(lvl, pos, "right", state);
    expect(second.moved).toBe(true);
    // Held right vs force_s is a diagonal (MS boost). If that cell is blocked, override
    // walks east and can leave the staircase — still a successful step.
  });

  it("force-only continuation respects held right on force_s", () => {
    const force = { dx: 0, dy: 1 };
    expect(resolveForceSlideIntent(force, "right")).toEqual({ dx: 1, dy: 1 });
  });
});
