import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { simulateMsCc1Level } from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelPath = path.join(
  __dirname,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-004.json",
);
const moves = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../scripts/level004-solution.json"), "utf8"),
) as Direction[];

describe("level 004 engine solution", () => {
  it("completes under sim replay (175 chip moves)", () => {
    const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
    normalizeLevelLayers(level);
    const sim = simulateMsCc1Level(structuredClone(level), moves);
    expect(sim.completed).toBe(true);
    expect(sim.playerDied).toBe(false);
    expect(moves.length).toBe(175);
  });
});
