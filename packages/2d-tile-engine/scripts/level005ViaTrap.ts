import { readFileSync, writeFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

type Action = Direction | "wait";
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

function sim(actions: Action[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  const letters: string[] = [];
  for (const a of actions) {
    if (a === "wait") {
      stepMsCc1Wait(r);
      letters.push("W");
    } else {
      stepMsCc1Simulation(r, a);
      letters.push(LETTER[a]);
    }
    if (r.playerDied || r.completed) break;
  }
  return { r, letters };
}

/** Best known completing route (rem 83). */
const best83: Action[] = [
  "up","up","right","up","up","up","up","left","left","left","left","left",
  "right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
  "wait","wait","wait","wait",
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left","up",
  "up","left","up","right","right","right",
  "left","left","left","up","up","up","right","right","right",
  "wait","wait","wait",
  "left","left","left","up","up","left","left",
];

const r83 = sim(best83);
console.log("baseline83", {
  completed: r83.r.completed,
  rem: msSecondsRemaining(100, r83.r.buttonPressCtx.moveBoundary),
  ticks: r83.r.buttonPressCtx.moveBoundary,
  moves: r83.letters.filter((c) => c !== "W").length,
  waits: r83.letters.filter((c) => c === "W").length,
});

/**
 * Try to save 2 seconds by replacing the long 7U from bottom with partial
 * up + left earlier onto y=13 hallway from x=21 after fewer ups... 
 * Can't — wall.
 *
 * Try: after key waits, DDD RRRRRRR UUUUUU (6U to y=14) — still need y=13.
 *
 * Boost idea: after brown2, go to brown1 via x=19 if trap open acts as floor.
 */
const viaTrap: Action[] = [
  "up","up","right","up","up","up","up","left","left","left","left","left",
  "right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
  "wait","wait","wait","wait",
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left","up",
  "up","left","up","right","right","right", // brown2 — trap 18,10 open
  // now go east through open trap row to brown1 faster?
  "right","right", // 18,10 on trap?
  "up","up","up", // 18,7
  "left","left", // 16,7 brown1
  "wait","wait","wait",
  "left","left","left","up","up","left","left",
];

const vt = sim(viaTrap);
console.log("viaTrap", {
  completed: vt.r.completed,
  died: vt.r.playerDied,
  death: vt.r.deathMessage,
  rem: msSecondsRemaining(100, vt.r.buttonPressCtx.moveBoundary),
  ticks: vt.r.buttonPressCtx.moveBoundary,
  pos: `${vt.r.gx},${vt.r.gy}`,
});

/** Key first (no open), then open — probably dies. */
const keyFirst: Action[] = [
  "down", // noop check start
];
void keyFirst;

/**
 * Compare tick cost if waits don't double-count: maybe exit waits can be
 * 0 if we delay brown1 until glider is ready — press brown1 later.
 */
const delayBrown1: Action[] = [
  "up","up","right","up","up","up","up","left","left","left","left","left",
  "right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
  "wait","wait","wait","wait",
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left","up",
  "up","left","up","right","right","right", // brown2 only
  // go toward exit corridor and press brown1 at last moment
  "left","left","left", // 13,10
  "up","up","up", // 13,7
  "right","right","right", // brown1
  "left","left","left","up","up","left","left",
];

for (let w = 0; w <= 8; w++) {
  const actions = [
    ...delayBrown1.slice(0, -7),
    ...Array<Action>(w).fill("wait" as const),
    ...delayBrown1.slice(-7),
  ];
  // rebuild more carefully
}

for (let w = 0; w <= 10; w++) {
  const actions: Action[] = [
    "up","up","right","up","up","up","up","left","left","left","left","left",
    "right","right","right","right","right",
    "down","down","down","down","down","down","down",
    "left","left","left","left","left","left","left","up","up","up",
    "wait","wait","wait","wait",
    "down","down","down",
    "right","right","right","right","right","right","right",
    "up","up","up","up","up","up","up",
    "left","left","left","left","left","left","left","up",
    "up","left","up","right","right","right",
    "left","left","left","up","up","up","right","right","right",
    ...Array<Action>(w).fill("wait"),
    "left","left","left","up","up","left","left",
  ];
  const { r, letters } = sim(actions);
  if (r.completed) {
    const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
    console.log("exitW", w, "rem", rem, "ticks", r.buttonPressCtx.moveBoundary);
    if (rem === 85) {
      writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
      console.log("EXACT", letters.join(""));
    }
  }
}
