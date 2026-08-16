import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const r = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < 792; i++) stepMsCc1Simulation(r, tws[i]!);
console.log("at thief", r.gx, r.gy, r.playerState.tools);

// Dump force floors near slide path
console.log("\nForce map x0-16 y1-12:");
for (let y = 1; y <= 12; y++) {
  let row = "";
  for (let x = 0; x <= 16; x++) {
    const t = getCompositeTile(r.level, x, y);
    const mark =
      r.gx === x && r.gy === y
        ? "@"
        : t === "wall"
          ? "#"
          : t === "force_n"
            ? "^"
            : t === "force_s"
              ? "v"
              : t === "force_e"
                ? ">"
                : t === "force_w"
                  ? "<"
                  : t === "empty"
                    ? "."
                    : t === "thief"
                      ? "T"
                      : t === "door_blue"
                        ? "B"
                        : t[0];
    row += mark;
  }
  console.log(String(y).padStart(2), row);
}

// Simulate slide step by step logging positions
const r2 = cloneMsCc1SimulationRunner(r);
console.log("\nSlide path:");
const before = r2.buttonPressCtx.moveBoundary;
stepMsCc1Simulation(r2, "down");
console.log("after D", {
  pos: { x: r2.gx, y: r2.gy },
  ticks: r2.buttonPressCtx.moveBoundary,
  delta: r2.buttonPressCtx.moveBoundary - before,
});
