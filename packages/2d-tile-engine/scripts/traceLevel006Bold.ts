/**
 * Trace + try variants for level 6 bold (94 remaining).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-006.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-006.json"), "utf8"),
);

function run(label: string, moves: Direction[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (let i = 0; i < moves.length; i++) {
    stepMsCc1Simulation(runner, moves[i]!);
    if (runner.completed || runner.playerDied) {
      const rem = msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary);
      console.log(
        label,
        "step",
        i + 1,
        moves[i]![0]!.toUpperCase(),
        `pos=${runner.gx},${runner.gy}`,
        `chips=${runner.playerState.chipsRemainingOnMap}`,
        `ticks=${runner.buttonPressCtx.moveBoundary}`,
        runner.completed ? `WIN rem=${rem}` : runner.playerDied ? "DIED" : "",
      );
      break;
    }
  }
}

const current = decodeSolutionMoves(sol.moves);
console.log("=== current ===");
run("current", current);

// StrategyWiki opener: 3L 3U 3L D
const wikiOpener = decodeSolutionMoves(["L", "L", "L", "U", "U", "U", "L", "L", "L", "D"]);
console.log("\n=== wiki opener only ===");
run("wiki", wikiOpener);

// Try wiki opener + suffix from move 11 onward of current (skip first 10 moves of current)
// Current starts LLLLL - maybe first 5L can be 3L?
const variant1 = [...wikiOpener, ...current.slice(10)];
console.log("\n=== wiki opener + current tail from move 11 ===");
run("v1", variant1);

// Current but drop one L at start (4L instead of 5L)
const variant2 = current.slice(1);
console.log("\n=== drop first L ===");
run("v2", variant2);

// 3L 3U 3L D + current from index where paths might merge
// After wiki opener at 13,12 - current after 10 moves is at?
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of wikiOpener) stepMsCc1Simulation(r, d);
console.log("\nwiki end", r.gx, r.gy, "chips", r.playerState.chipsRemainingOnMap);

for (let start = 0; start <= 15; start++) {
  const r2 = createMsCc1SimulationRunner(structuredClone(level));
  for (let i = 0; i < start; i++) stepMsCc1Simulation(r2, current[i]!);
  if (r2.gx === r.gx && r2.gy === r.gy && r2.playerState.chipsRemainingOnMap === r.playerState.chipsRemainingOnMap) {
    const variant = [...wikiOpener, ...current.slice(start)];
    const runner = createMsCc1SimulationRunner(structuredClone(level));
    for (const d of variant) {
      if (stepMsCc1Simulation(runner, d)) break;
    }
    if (runner.completed) {
      const rem = msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary);
      console.log(`merge at ${start}: moves=${variant.length} ticks=${runner.buttonPressCtx.moveBoundary} rem=${rem}`);
    }
  }
}
