import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";

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

const progress = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-sw-progress.json"), "utf8"),
) as { full: string[]; failedAt?: string };

const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of progress.full) {
  if (ch === "W") stepMsCc1Wait(runner);
  else {
    const d =
      ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right";
    stepMsCc1Simulation(runner, d as any);
  }
}

console.log({
  pos: { x: runner.gx, y: runner.gy },
  tools: runner.playerState.tools,
  keys: runner.playerState.keys,
  chips: runner.playerState.chipsRemainingOnMap,
  ticks: runner.buttonPressCtx.moveBoundary,
  moves: progress.full.join(""),
});

// dump SW/NW corners
for (const [label, x0, y0, x1, y1] of [
  ["SW", 4, 13, 12, 16],
  ["NW", 4, 9, 12, 13],
  ["center", 12, 9, 22, 17],
] as const) {
  console.log("\n" + label);
  for (let y = y0; y <= y1; y++) {
    let row = "";
    for (let x = x0; x <= x1; x++) {
      const t = getCompositeTile(runner.level, x, y);
      const mark =
        runner.gx === x && runner.gy === y
          ? "@"
          : t === "empty"
            ? "."
            : t[0];
      row += mark;
    }
    console.log(y, row);
  }
}
