import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import type { LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { simulateMsCc1Level } from "../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelPath = path.join(
  __dirname,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
);

describe("level 002 engine solution", () => {
  it("completes under sim replay (StrategyWiki bold, 51 chip moves)", () => {
    const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
    normalizeLevelLayers(level);
    const sol = readLevelSolution<{ moves: string[] }>(2)!;
    const moves = decodeSolutionMoves(sol.moves);
    const sim = simulateMsCc1Level(structuredClone(level), moves);
    expect(sim.completed).toBe(true);
    expect(sim.playerDied).toBe(false);
    expect(moves.length).toBe(51);
  });
});
