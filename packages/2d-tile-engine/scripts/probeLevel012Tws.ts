import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-012.json"), "utf8"),
) as {
  twsRecords: Array<{ tick: number; direction: number; dir?: string }>;
  boldTimeRemaining: number;
  minChipMoves: number;
};

console.log({
  twsRecords: sol.twsRecords.length,
  chipsRequired: level.chipsRequired,
  bold: sol.boldTimeRemaining,
  minChipMoves: sol.minChipMoves,
});

const tws = replayTwsRecords(structuredClone(level), sol.twsRecords);
console.log("replayTwsRecords", {
  completed: tws.completed,
  died: tws.playerDied,
  death: tws.deathMessage,
  chipMoves: tws.chipMoves.length,
  waitTicks: tws.waitTicks,
  pos: tws.finalPosition,
  chipsLeft: tws.finalPlayerState?.chipsRemainingOnMap,
  chipsCollected: tws.finalPlayerState?.chipsCollected,
});

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

function twsToSolutionLetters(
  records: Array<{ tick: number; direction: number }>,
): string[] {
  const out: string[] = [];
  let prev = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    const gap = Math.max(0, rec.tick - prev - 1);
    for (let i = 0; i < gap + 1; i += 1) out.push("W");
    out.push(LETTER[dir]);
    prev = rec.tick;
  }
  return out;
}

function replayLetters(letters: string[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else {
      const dir =
        ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right";
      stepMsCc1Simulation(r, dir as Direction);
    }
    if (r.completed || r.playerDied) break;
  }
  return r;
}

const letters = twsToSolutionLetters(sol.twsRecords);
const r = replayLetters(letters);
const rem = msSecondsRemaining(400, r.buttonPressCtx.moveBoundary);
console.log("lettersWithWaits", {
  letters: letters.length,
  waits: letters.filter((c) => c === "W").length,
  chipMovesLetters: letters.filter((c) => c !== "W").length,
  completed: r.completed,
  died: r.playerDied,
  death: r.deathMessage,
  pos: `${r.gx},${r.gy}`,
  ticks: r.buttonPressCtx.moveBoundary,
  rem,
  chipsLeft: r.playerState.chipsRemainingOnMap,
  chipsCollected: r.playerState.chipsCollected,
  boldExact: rem === 270,
});

if (r.completed) {
  writeFileSync(
    path.join(root, "scripts/level012-letters.json"),
    JSON.stringify(letters, null, 2) + "\n",
  );
  console.log("wrote scripts/level012-letters.json");
}
