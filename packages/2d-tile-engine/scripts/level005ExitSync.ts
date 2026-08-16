import { readFileSync, writeFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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

const base: Action[] = [
  "up","up","right","up","up","up","up",
  "left","left","left","left","left","left","left","right","right",
  "right","right","right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left","up",
  "up","left","up","right","right","right",
  "left","left","left","up","up","up","right","right","right",
];

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

// Trace exit approaches step by step from after browns
const exits: Action[][] = [
  ["left","left","left","up","up","left","left"],
  ["left","left","left","up","wait","up","left","left"],
  ["left","left","left","up","up","wait","left","left"],
  ["left","left","left","up","up","wait","wait","left","left"],
  ["left","left","left","wait","up","up","left","left"],
  ["wait","left","left","left","up","up","left","left"],
  ["wait","wait","left","left","left","up","up","left","left"],
  ["left","left","wait","left","up","up","left","left"],
  // longer path but sync with glider
  ["left","left","left","up","up","up","down","left","left"],
];

for (const exit of exits) {
  const { r, letters } = sim([...base, ...exit]);
  const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
  console.log(exit.map((a) => (a === "wait" ? "W" : a[0])).join(""), {
    completed: r.completed,
    died: r.playerDied,
    death: r.deathMessage,
    pos: `${r.gx},${r.gy}`,
    rem,
    ticks: r.buttonPressCtx.moveBoundary,
    bomb: getCompositeTile(r.level, 12, 5),
  });
  if (r.completed && rem === 85) {
    writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
    console.log("EXACT", letters.join(""));
  }
}

// Shorten the trap/key/door approach by 10 ticks
const shortBase: Action[] = [
  // faster trap: open, wait for ball west while standing?, close
  "up","up","right","up","up","up","up","left","left","left","left","left",
  "wait","wait","left","left", // ball west?
  "right","right", // close
  // key
  "right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
  // door via shorter? 
  "down","down","down","right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up","left","left","left","left","left","left","left","up",
  "up","left","up","right","right","right",
  "left","left","left","up","up","up","right","right","right",
  "left","left","left","up","up","left","left",
];

const s = sim(shortBase);
console.log("shortBase", {
  completed: s.r.completed,
  died: s.r.playerDied,
  death: s.r.deathMessage,
  pos: `${s.r.gx},${s.r.gy}`,
  rem: msSecondsRemaining(100, s.r.buttonPressCtx.moveBoundary),
  keys: s.r.playerState.keys,
  bomb: getCompositeTile(s.r.level, 12, 5),
});
