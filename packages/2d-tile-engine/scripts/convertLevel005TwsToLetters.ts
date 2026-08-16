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
import type { Direction, LevelData } from "../engine/types.js";

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
) as {
  twsRecords: Array<{ tick: number; direction: number; dir?: string }>;
};

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

/** Convert TWS tick records → explicit U/D/L/R + W (wait) letters. */
function twsToSolutionLetters(
  records: Array<{ tick: number; direction: number }>,
): string[] {
  const out: string[] = [];
  let prev = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    // TWS: (tick - prevTick - 1) pure idles, then one idle before the chip step.
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
const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
console.log({
  letters: letters.length,
  waits: letters.filter((c) => c === "W").length,
  chipMoves: letters.filter((c) => c !== "W").length,
  completed: r.completed,
  died: r.playerDied,
  death: r.deathMessage,
  pos: `${r.gx},${r.gy}`,
  ticks: r.buttonPressCtx.moveBoundary,
  rem,
  boldExact: rem === 85,
});

if (r.completed && rem === 85) {
  writeFileSync(
    path.join(root, "scripts/level005-letters.json"),
    JSON.stringify(letters, null, 2) + "\n",
  );
  console.log("wrote scripts/level005-letters.json");
}
