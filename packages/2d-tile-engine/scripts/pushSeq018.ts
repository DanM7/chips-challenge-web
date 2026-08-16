/**
 * Execute StrategyWiki push sequence after walking to (25,5).
 */
import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile, setUpperTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
setUpperTile(level, 4, 29, "empty");

const DIR: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
const to255 = "LUUULLUUURRUUURRUUUURUUURRRUURUURUURRRRURRUURRRRRRR";

function blocks(r: ReturnType<typeof createMsCc1SimulationRunner>) {
  const out: string[] = [];
  for (let y = 0; y < 10; y++) {
    for (let x = 20; x < 32; x++) {
      if (getCompositeTile(r.level, x, y) === "block_movable") out.push(`${x},${y}`);
    }
  }
  return out.join(" ");
}

function run(letters: string, label: string) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  let i = 0;
  for (const ch of letters) {
    const d = DIR[ch];
    if (!d) continue;
    const bx = r.gx,
      by = r.gy;
    stepMsCc1Simulation(r, d);
    i++;
    const moved = r.gx !== bx || r.gy !== by;
    if (!moved || r.playerDied || r.completed || i > letters.length - 5 || "RUU".includes(ch)) {
      // print interesting
    }
  }
  // step-by-step for suffix only
  return r;
}

// Walk to 25,5 then try push variants with verbose
const variants = [
  to255 + "RRUU", // classic 2R 2U from west
  to255 + "R", // 1R
  to255 + "RR", // 2R
  to255 + "RR D", // can't
  to255 + "RRU",
  to255 + "RURU",
  to255 + "RDRUUR", // try around
];

for (const v of [to255 + "RR", to255 + "RRUU", to255 + "R R U U".replace(/ /g, "")]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  const seq = v;
  console.log("\n===", seq.slice(-10), "===");
  for (let i = 0; i < seq.length; i++) {
    const ch = seq[i]!;
    const d = DIR[ch];
    if (!d) continue;
    const bx = r.gx,
      by = r.gy;
    stepMsCc1Simulation(r, d);
    if (i >= to255.length - 1) {
      console.log(
        i,
        ch,
        `${bx},${by}->${r.gx},${r.gy}`,
        "blocks",
        blocks(r),
        "tools",
        r.playerState.tools,
      );
    }
  }
  console.log("final", r.gx, r.gy, "mb", r.buttonPressCtx.moveBoundary, "rem", msSecondsRemaining(600, r.buttonPressCtx.moveBoundary));
}

// After 2R, where can Chip go? Explore neighbors
{
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of to255 + "RR") stepMsCc1Simulation(r, DIR[ch]!);
  console.log("\nAfter 2R at", r.gx, r.gy, "blocks", blocks(r));
  for (const [ch, d] of Object.entries(DIR)) {
    const s = createMsCc1SimulationRunner(structuredClone(level));
    for (const c of to255 + "RR") stepMsCc1Simulation(s, DIR[c]!);
    const bx = s.gx,
      by = s.gy;
    stepMsCc1Simulation(s, d);
    console.log(" try", ch, `${bx},${by}->${s.gx},${s.gy}`, "blocks", blocks(s));
  }
  // local map
  console.log("local:");
  for (let y = 3; y <= 7; y++) {
    let row = "";
    for (let x = 24; x <= 30; x++) {
      if (x === r.gx && y === r.gy) row += "C";
      else {
        const t = getCompositeTile(r.level, x, y);
        row += t === "wall" ? "#" : t === "block_movable" ? "B" : ".";
      }
    }
    console.log(y, row);
  }
}
