/**
 * Walk StrategyWiki Digger route segment-by-segment with odd step.
 * Engine must treat teeth as blocked by chips.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

function expand(route: string): Direction[] {
  const out: Direction[] = [];
  const re = /(\d+)?([UDLR])/g;
  let m: RegExpExecArray | null;
  const map: Record<string, Direction> = {
    U: "up",
    D: "down",
    L: "left",
    R: "right",
  };
  while ((m = re.exec(route.replace(/\s/g, ""))) !== null) {
    const n = m[1] ? Number(m[1]) : 1;
    for (let i = 0; i < n; i++) out.push(map[m[2]!]!);
  }
  return out;
}

function play(moves: Direction[], parity: "even" | "odd", verbose = false): MsCc1SimulationRunner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (let i = 0; i < moves.length; i++) {
    const before = `${r.gx},${r.gy}`;
    stepMsCc1Simulation(r, moves[i]!);
    if (verbose) {
      const stuck = before === `${r.gx},${r.gy}`;
      console.log(
        `#${i + 1} ${moves[i]![0]!.toUpperCase()} ${before}->${r.gx},${r.gy} ${getCompositeTile(r.level, r.gx, r.gy)} chips=${r.playerState.chipsRemainingOnMap}${stuck ? " STUCK" : ""}${r.playerDied ? " DEAD" : ""}${r.completed ? " WIN" : ""}`,
      );
    }
    if (r.playerDied || r.completed) break;
  }
  return r;
}

function summary(label: string, r: MsCc1SimulationRunner) {
  console.log(
    label,
    `pos=${r.gx},${r.gy} chips=${r.playerState.chipsRemainingOnMap} mb=${r.buttonPressCtx.moveBoundary} rem=${msSecondsRemaining(210, r.buttonPressCtx.moveBoundary)} died=${r.playerDied} done=${r.completed}`,
  );
}

const PARITY: "even" | "odd" = "odd";

// Variants of opening
for (const open of [
  "11D8R9U", // TWS follow chips
  "11D9R8U", // SW literal above exit
  "11D8R8U",
  "11D9R9U",
]) {
  summary(open, play(expand(open), PARITY));
}

// Full SW text as numbers — try several interpretations of "down to teeth R 5U"
const bases = [
  // A: TWS open + SW mid
  "11D8R9U6L2D3U11R",
  "11D8R9U6L3D3U11R", // TWS
  "11D9R8U6L2D3U11R", // SW
];

for (const b of bases) {
  summary("base " + b.slice(0, 20), play(expand(b), PARITY));
}

// From TWS base, try down-to-teeth variants
const twsBase = "11D8R9U6L3D3U11R";
for (const down of ["7DR5U", "6DR5U", "8DR5U", "3D6R4D4U6L2D5U", "R7DR5U", "2D7DR5U"]) {
  const r = play(expand(twsBase + down), PARITY);
  summary("down " + down, r);
}

// Once we have a surviving R5U, continue SW dodge
const survivors: string[] = [];
for (const down of ["7DR5U", "6DR5U", "8DR5U", "5DR5U", "4DR5U", "9DR5U", "7D2R5U", "6D2R5U", "8D2R5U"]) {
  const path = twsBase + down;
  const r = play(expand(path), PARITY);
  if (!r.playerDied) {
    survivors.push(path);
    summary("SURVIVE " + down, r);
  }
}

console.log("survivors", survivors.length);

for (const path of survivors) {
  for (const dodge of [
    "5L5D8R",
    "5L5D8RL7D",
    "5L5D8RL7D8L2U",
    "5L5D8RL7D8L2U4D5LUD8LD",
    "5L5D8RL7D8L2U4D5LUD8LDU3R5U5L3U",
  ]) {
    const r = play(expand(path + dodge), PARITY);
    if (!r.playerDied || dodge.length < 10) {
      summary(path.slice(-8) + "+" + dodge.slice(0, 20), r);
    }
    if (r.playerDied) {
      summary("DIE " + path.slice(-8) + "+" + dodge, r);
      break;
    }
  }
}
