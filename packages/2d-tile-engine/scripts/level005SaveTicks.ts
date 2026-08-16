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
    if (r.playerDied || r.completed) {
      return { r, letters, deadAt: letters.length };
    }
  }
  return { r, letters, deadAt: -1 };
}

function fires(r: ReturnType<typeof createMsCc1SimulationRunner>) {
  return r.monsters
    .filter((m) => m.alive && m.kind === "fireball")
    .map((f) => `${f.x},${f.y}`)
    .join(" ");
}

// Open only, rush key with optional waits before entering 14,20→14,17
const openOnly: Action[] = [
  "up","up","right","up","up","up","up","left","left","left","left","left",
];

for (let w = 0; w <= 15; w++) {
  const toKey: Action[] = [
    ...openOnly,
    ...Array<Action>(w).fill("wait"),
    "right","right","right","right","right",
    "down","down","down","down","down","down","down",
    "left","left","left","left","left","left","left",
    "up","up","up",
  ];
  const { r, letters } = sim(toKey);
  if (!r.playerDied && r.playerState.keys.some((k) => k.includes("red"))) {
    console.log("key ok waits", w, "rem", msSecondsRemaining(100, r.buttonPressCtx.moveBoundary), "fires", fires(r), "pos", r.gx, r.gy);
  } else if (r.playerDied) {
    console.log("key DIE waits", w, r.deathMessage, "pos", r.gx, r.gy, "fires", fires(r));
  }
}

// L R trap (save 2) + rest of proven route + exit with 3 waits
const efficient: Action[] = [
  "up","up","right","up","up","up","up","left","left","left","left","left",
  "left",
  "wait","wait","wait","wait",
  "right", // close when ball west
  "right","right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left","up",
  "up","left","up","right","right","right",
  "left","left","left","up","up","up","right","right","right",
  "wait","wait","wait",
  "left","left","left","up","up","left","left",
];

const e = sim(efficient);
console.log("efficient", {
  completed: e.r.completed,
  died: e.r.playerDied,
  death: e.r.deathMessage,
  rem: msSecondsRemaining(100, e.r.buttonPressCtx.moveBoundary),
  ticks: e.r.buttonPressCtx.moveBoundary,
  keys: e.r.playerState.keys,
  pos: `${e.r.gx},${e.r.gy}`,
  bomb: getCompositeTile(e.r.level, 12, 5),
  moves: e.letters.filter((c) => c !== "W").length,
  waits: e.letters.filter((c) => c === "W").length,
});
if (e.r.completed) {
  writeFileSync("scripts/level005-letters.json", JSON.stringify(e.letters) + "\n");
  console.log(e.letters.join(""));
}
