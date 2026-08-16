import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { createMsCc1SimulationRunner, stepMsCc1Simulation } from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-005.json"), "utf8"),
);

const tws = replayTwsRecords(structuredClone(level), sol.twsRecords);
console.log("TWS replay:", {
  completed: tws.completed,
  died: tws.playerDied,
  chipMoves: tws.chipMoves.length,
  pos: tws.finalPosition,
});

const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const d of tws.chipMoves) {
  if (stepMsCc1Simulation(runner, d)) break;
}
const rem = msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary);
console.log("Chip-only replay:", {
  completed: runner.completed,
  died: runner.playerDied,
  moves: tws.chipMoves.length,
  ticks: runner.buttonPressCtx.moveBoundary,
  rem,
  bold: rem >= 85,
});
console.log(tws.chipMoves.map((d) => d[0]!.toUpperCase()).join(" "));
