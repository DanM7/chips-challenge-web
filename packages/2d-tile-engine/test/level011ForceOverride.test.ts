import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import type { Direction, LevelData } from "../engine/types.js";

const level011Path = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-011.json",
);

function loadLevel011(): LevelData {
  const raw = JSON.parse(readFileSync(level011Path, "utf8")) as LevelData;
  normalizeLevelLayers(raw);
  return raw;
}

describe("level 11 Trinity force-floor override", () => {
  it("walks north through force_s after D 3L D (MS override)", () => {
    const level = loadLevel011();
    const r = createMsCc1SimulationRunner(structuredClone(level));
    for (const d of ["down", "left", "left", "left", "down"] as Direction[]) {
      stepMsCc1Simulation(r, d);
    }
    expect(r.gx).toBe(11);
    expect(r.gy).toBe(20);
    expect(getForceFloorTileAt(r.level, 11, 19)).toBe("force_s");

    stepMsCc1Simulation(r, "up");
    expect(r.playerDied).toBe(false);
    expect(r.gy).toBeLessThan(20);
    expect(r.gx).toBe(11);
    expect(r.gy).toBe(18);
  });
});
