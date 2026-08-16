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
      const mons = r.monsters
        .filter((m) => m.alive)
        .map((m) => `${m.x},${m.y}${m.direction[0]}`)
        .join(";");
      console.log(
        `#${i + 1} ${ch} ${before}->${r.gx},${r.gy} ${getCompositeTile(r.level, r.gx, r.gy)} chips=${r.playerState.chipsRemainingOnMap} mb=${r.buttonPressCtx.moveBoundary}${`${r.gx},${r.gy}` === before ? " STUCK" : ""}${r.playerDied ? " DEAD:" + r.deathMessage : ""}${r.completed ? " WIN" : ""} m=[${mons}]`,
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

// Through 5L5D8R
const base =
  "11D9R8U6L2D3U11R7DR5U5L5D8R";

console.log("base", sim(expandLetters(base)));

// L 7D (teeth) 8L 2U 4D 5L UD 8L D
const p1 = base + "L7D";
console.log("L7D", sim(expandLetters(p1), "odd", 80));

const p2 = base + "L7D8L2U";
console.log("L7D8L2U", sim(expandLetters(p2)));

const p3 = base + "L7D8L2U4D5LUD8LD";
console.log("full dodge block", sim(expandLetters(p3), "odd", 90));

// Escape U 3R 5U 5L 3U
const p4 = base + "L7D8L2U4D5LUD8LDU3R5U5L3U";
console.log("escape", sim(expandLetters(p4), "odd", 120));
