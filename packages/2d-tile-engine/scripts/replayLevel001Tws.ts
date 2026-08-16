import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  replayTwsRecords,
} from "../engine/msCc1/msCc1Simulation.js";
import { replayTwsRecords as replay } from "../engine/twsReplay.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const tws = JSON.parse(readFileSync("integration/data/cc1-ms-tws-records.json", "utf8")) as {
  solutions: Array<{ number: number; moves: Array<{ tick: number; direction: number; dir: string }> }>;
};
const sol = tws.solutions.find((s) => s.number === 1)!;

const result = replay(structuredClone(level), sol.moves);
console.log("TWS replay", {
  completed: result.completed,
  died: result.playerDied,
  death: result.deathMessage,
  chips: result.chipsRemainingOnMap,
  pos: result.position,
  ticks: result.moveBoundary,
  rem: msSecondsRemaining(100, result.moveBoundary ?? 0),
  chipMoves: result.chipMoves.length,
  waitTicks: result.waitTicks,
  letters: result.chipMoves.map((d) => d[0]!.toUpperCase()).join(""),
});

// Also: directions only, no waits
const runner = createMsCc1SimulationRunner(structuredClone(level));
const LETTER: Record<string, string> = { left: "L", right: "R", up: "U", down: "D" };
let letters = "";
for (const m of sol.moves) {
  const d = m.dir as Direction;
  const before = { x: runner.gx, y: runner.gy };
  stepMsCc1Simulation(runner, d);
  letters += LETTER[d];
  if (runner.gx === before.x && runner.gy === before.y && !runner.completed) {
    console.log("dir-only blocked at", letters.length, d, before, "keys", runner.playerState.keys);
    break;
  }
  if (runner.completed || runner.playerDied) break;
}
console.log("dir-only", {
  completed: runner.completed,
  died: runner.playerDied,
  ticks: runner.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary),
  letters,
  len: letters.length,
});
