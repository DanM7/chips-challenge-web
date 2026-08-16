import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const tws = JSON.parse(readFileSync("integration/data/cc1-ms-tws-records.json", "utf8")) as {
  solutions: Array<{ number: number; moves: Array<{ tick: number; direction: number }> }>;
};
const sol = tws.solutions.find((s) => s.number === 1)!;
const result = replayTwsRecords(structuredClone(level), sol.moves);
console.log(JSON.stringify(result, null, 2).slice(0, 800));
console.log({
  completed: result.completed,
  moveBoundary: result.moveBoundary,
  rem: msSecondsRemaining(100, result.moveBoundary),
  chipMoves: result.chipMoves.length,
  waitTicks: result.waitTicks,
});
