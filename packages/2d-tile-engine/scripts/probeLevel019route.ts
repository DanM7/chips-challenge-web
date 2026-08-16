import { readFileSync, writeFileSync } from "node:fs";
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

function sim(
  letters: string[],
  parity: "even" | "odd" = "odd",
  verbose = false,
  every = 1,
) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i]!;
    if (ch === "W") stepMsCc1Wait(r);
    else {
      const dir =
        ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right";
      const before = `${r.gx},${r.gy}`;
      stepMsCc1Simulation(r, dir as Direction);
      if (verbose && (i % every === 0 || r.playerDied || r.completed || r.gx + "," + r.gy === before)) {
        const tile = getCompositeTile(r.level, r.gx, r.gy);
        const stuck = `${r.gx},${r.gy}` === before;
        console.log(
          `#${i + 1} ${ch} ${before}->${r.gx},${r.gy} ${tile} chips=${r.playerState.chipsRemainingOnMap} mb=${r.buttonPressCtx.moveBoundary}${stuck ? " STUCK" : ""}${r.playerDied ? " DEAD:" + r.deathMessage : ""}${r.completed ? " WIN" : ""}`,
        );
      }
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
        letters: letters.slice(0, i + 1),
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
      .map((m) => `${m.kind}@${m.x},${m.y}${m.direction[0]}`),
  };
}

// SW: follow chips to exit, 8U, 6L 2D, 3U 11R, down to teeth, R 5U,
// then 5L 5D 8R (teeth) L 7D (teeth) 8L 2U 4D 5L UD 8L D
// Escape U 3R 5U 5L 3U; NE toward exit; remaining chips CCW; exit

const part1 =
  "11D" + // down chip column to (3,13)
  "9R" + // to above exit (12,13)
  "8U" + // to (12,5)
  "6L2D" + // (6,7)
  "3U11R"; // (6,4) then (17,4)

console.log("part1", sim(expandLetters(part1), "odd"));

// "down to a teeth, R 5U to give him room"
// From (17,4), teeth at (16,11). Go down the corridor at x=18?
// Looking at map: vertical chips at x=18 from row 4-13, and teeth at 16,11
// From (17,4): maybe R then down the chip column at x=18?
const part2a = part1 + "R9D"; // (18,4) down toward teeth
console.log("part2a R9D", sim(expandLetters(part2a), "odd"));

const part2b = part1 + "RD9D";
console.log("part2b", sim(expandLetters(part2b), "odd"));

// Try going down from (17,4) directly
const part2c = part1 + "7D"; // toward (17,11) near teeth at 16,11
console.log("part2c 7D", sim(expandLetters(part2c), "odd", true, 1));

// After reaching near teeth: R 5U
const part2d = part1 + "7DR5U";
console.log("part2d", sim(expandLetters(part2d), "odd"));

// Maybe down the left of that room - chips at x=13 column?
// Row 4-12: @ at x=13 in corridor
const part2e = part1 + "4L7D"; // from (17,4) left to (13,4) down
console.log("part2e", sim(expandLetters(part2e), "odd"));

const part2f = part1 + "R8D"; // down x=18
console.log("part2f", sim(expandLetters(part2f), "odd", true));
