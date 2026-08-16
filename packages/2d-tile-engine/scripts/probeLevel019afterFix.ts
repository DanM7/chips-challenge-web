import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
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
const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { direction: number }[] };
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const dirs = sol.twsRecords
  .map((r) => TWS_DIR[r.direction])
  .filter((d): d is Direction => !!d);

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

function run(moves: Direction[], parity: "even" | "odd") {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (let i = 0; i < moves.length; i++) {
    stepMsCc1Simulation(r, moves[i]!);
    if (r.playerDied || r.completed) {
      return {
        parity,
        i: i + 1,
        done: r.completed,
        died: r.playerDied,
        death: r.deathMessage,
        pos: `${r.gx},${r.gy}`,
        chips: r.playerState.chipsRemainingOnMap,
        mb: r.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
      };
    }
  }
  return {
    parity,
    i: moves.length,
    done: r.completed,
    died: r.playerDied,
    pos: `${r.gx},${r.gy}`,
    chips: r.playerState.chipsRemainingOnMap,
    mb: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
  };
}

console.log("TWS odd", run(dirs, "odd"));
console.log("TWS even", run(dirs, "even"));

// StrategyWiki numeric route (best-effort)
const sw =
  "11D9R8U6L2D3U11R7DR5U5L5D8RL7D8L2U4D5LUD8LDU3R5U5L3U";
console.log("SW partial odd", run(expand(sw), "odd"));
console.log("SW partial even", run(expand(sw), "even"));

// TWS opening + SW dodge
const hybrid =
  "11D8R9U6L3D3U11R3D6R4D4U6L2D5U5L5D8RL7D8L2U4D5LUD8LDU3R5U5L3U";
console.log("hybrid odd", run(expand(hybrid), "odd"));
console.log("hybrid even", run(expand(hybrid), "even"));
