import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

function expandLetters(route: string): string[] {
  const out: string[] = [];
  const re = /(\d+)?([UDLRW])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(route.replace(/\s/g, ""))) !== null) {
    const count = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < count; i++) out.push(m[2]!);
  }
  return out;
}

function sim(letters: string[], parity: "even" | "odd" = "odd", verboseFrom = -1) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i]!;
    const before = `${r.gx},${r.gy}`;
    if (ch === "W") stepMsCc1Wait(r);
    else {
      const dir =
        ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right";
      stepMsCc1Simulation(r, dir as Direction);
    }
    if (verboseFrom >= 0 && i + 1 >= verboseFrom) {
      console.log(
        `#${i + 1} ${ch} ${before}->${r.gx},${r.gy} ${getCompositeTile(r.level, r.gx, r.gy)} chips=${r.playerState.chipsRemainingOnMap} mb=${r.buttonPressCtx.moveBoundary}${`${r.gx},${r.gy}` === before ? " STUCK" : ""}${r.playerDied ? " DEAD:" + r.deathMessage : ""}${r.completed ? " WIN" : ""}`,
      );
    }
    if (r.playerDied || r.completed) {
      return {
        died: r.playerDied,
        completed: r.completed,
        death: r.deathMessage,
        pos: `${r.gx},${r.gy}`,
        chips: r.playerState.chipsRemainingOnMap,
        ticks: r.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
        at: i + 1,
      };
    }
  }
  return {
    died: false,
    completed: r.completed,
    pos: `${r.gx},${r.gy}`,
    chips: r.playerState.chipsRemainingOnMap,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
    at: letters.length,
    monsters: r.monsters
      .filter((m) => m.alive)
      .map((m) => `T@${m.x},${m.y}${m.direction[0]}`),
  };
}

// Core SW through R5U after first teeth
const core =
  "11D9R8U6L2D3U11R" + // to (17,4)
  "7DR5U"; // down to teeth, R 5U → (18,6)

console.log("core", sim(expandLetters(core)));

// "follow to the next teeth and 5L 5D 8R"
// From (18,6), next teeth could be at (24,16) area or (16,17)
// Chip corridor continues at x=18 down? or go right on chips?

// Looking at chips: x=24 column has chips from y=4 to 13
// From (18,6): maybe 6R to (24,6) then down?
const t1 = core + "6R7D";
console.log("t1 6R7D", sim(expandLetters(t1)));

const t2 = core + "6R10D";
console.log("t2 6R10D", sim(expandLetters(t2)));

// Or follow dirt/chips south first then 5L5D8R as the maneuver at the teeth
// Maybe "follow to next teeth" means continue collecting until you meet them, then do the dodge pattern
const t3 = core + "D5L5D8R";
console.log("t3 D5L5D8R", sim(expandLetters(t3), "odd", 60));

const t4 = core + "2D5L5D8R";
console.log("t4", sim(expandLetters(t4)));

const t5 = core + "3D5L5D8R";
console.log("t5", sim(expandLetters(t5)));

const t6 = core + "4D5L5D8R";
console.log("t6", sim(expandLetters(t6)));

const t7 = core + "5D5L5D8R";
console.log("t7", sim(expandLetters(t7)));

const t8 = core + "6D5L5D8R";
console.log("t8", sim(expandLetters(t8)));

const t9 = core + "7D5L5D8R";
console.log("t9", sim(expandLetters(t9)));

// Maybe go left first into the chip U shape
const t10 = core + "5L5D8R";
console.log("t10 direct 5L5D8R", sim(expandLetters(t10), "odd", 63));
