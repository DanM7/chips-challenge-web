import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const tws = JSON.parse(readFileSync("integration/data/cc1-ms-tws-records.json", "utf8")) as {
  solutions: Array<{ number: number; moves: Array<{ tick: number; direction: number }> }>;
};
const sol = tws.solutions.find((s) => s.number === 2)!;
const r = replayTwsRecords(structuredClone(level), sol.moves);
console.log({
  completed: r.completed,
  died: r.playerDied,
  death: r.deathMessage,
  chips: r.chipsRemainingOnMap,
  pos: r.position,
  ticks: r.moveBoundary,
  rem: msSecondsRemaining(100, r.moveBoundary || 0),
  n: r.chipMoves.length,
  letters: r.chipMoves.map((d) => d[0]!.toUpperCase()).join(""),
});
