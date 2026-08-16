/**
 * Pad patched Castle Moat route to exact rem=553, confirm unpatched trap.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, setUpperTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const levelPath =
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json";
const solPath =
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-018.json";

const DIR: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };

const BASE =
  "LUUULLUUURRUUURRUUUURUUURRRUURUURUURRRRURRUURRRRRRRRRDRUURRUUULLRRDDDLLDLLLDDLLLLLLLLDLLDLLLDDDLDLDLLLDDDDDLDDLLDDDLLDDDRRDRRRRRRURRRDRDRRRRRRRRUUUURU";

function load(patch429: boolean): LevelData {
  const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  if (patch429 && cellTile(level, "upper", 4, 29) === "wall") {
    setUpperTile(level, 4, 29, "empty");
  }
  return level;
}

function simulate(level: LevelData, letters: string) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    const d = DIR[ch];
    if (!d) continue;
    stepMsCc1Simulation(r, d);
    if (r.playerDied || r.completed) break;
  }
  return {
    completed: r.completed,
    died: r.playerDied,
    pos: `${r.gx},${r.gy}`,
    mb: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(600, r.buttonPressCtx.moveBoundary),
    moves: letters.length,
  };
}

const patched = load(true);
console.log("base patched", simulate(patched, BASE));

// Need rem 553 → floor(mb/5)=47 → mb in 235..239. Currently mb=149 → need +86..+90
// Pad by walking back-and-forth before the final exit step.
// Find a safe hallway near the end to shuttle.

// Split: everything but last move, pad, then last moves onto exit
const withoutLast = BASE.slice(0, -1); // leave last U?
console.log("without last char", BASE.slice(-5), simulate(patched, withoutLast));

// From finishLevel018, exit path ends with UUUURU onto exit. 
// Before entering castle, shuttle on gravel/floor.
// Simpler: after flippers prefix, add 86 RL pairs on open floor, then continue.

const FLIP_END = 64; // approx index after flippers path
// Use known position after getting flippers - insert pads at start after LU escape
// Easiest: after "LU", walk up and down a corridor.

// After LUUULLUUU (reach open area), pad there
const head = "LUUULLUUU"; // at some open cell
const mid = BASE.slice(head.length);
const r0 = createMsCc1SimulationRunner(structuredClone(patched));
for (const ch of head) stepMsCc1Simulation(r0, DIR[ch]!);
console.log("pad site", r0.gx, r0.gy);

// Try RL shuttle
for (const padCount of [86, 87, 88, 89, 90, 91, 92]) {
  let pad = "";
  for (let i = 0; i < padCount; i++) pad += i % 2 === 0 ? "R" : "L";
  // Check if RL works at pad site - may hit walls. Use DU instead
  pad = "";
  for (let i = 0; i < padCount; i++) pad += i % 2 === 0 ? "D" : "U";
  const letters = head + pad + mid;
  const res = simulate(patched, letters);
  if (res.completed) {
    console.log("DU pad", padCount, res);
    if (res.rem === 553) {
      console.log("FOUND", letters);
      break;
    }
  } else {
    console.log("DU pad fail", padCount, res);
    break;
  }
}

console.log("unpatched base", simulate(load(false), BASE));
console.log("start cell 4,29", cellTile(load(false), "upper", 4, 29));
