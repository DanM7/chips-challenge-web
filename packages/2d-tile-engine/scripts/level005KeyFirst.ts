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

// Key first: from start go left along bottom to key ASAP
for (let w = 0; w <= 10; w++) {
  const actions: Action[] = [
    "left","left","left","left","left","left", // 14,19 — fire at 15,19!
  ];
  void actions;
}

// From start 20,19: D is wall. L toward key along 19 hits fire at 15.
// Must go to 20 first: from 20,19 D? 20,20 empty. LLLLLL to 14,20, UUU to key.
for (let pre = 0; pre <= 5; pre++) {
  const actions: Action[] = [
    ...Array<Action>(pre).fill("wait"),
    "down",
    "left","left","left","left","left","left",
    "up","up","up",
  ];
  const { r } = sim(actions);
  console.log(
    "keyFirst preW",
    pre,
    r.playerDied ? r.deathMessage : "ok",
    `${r.gx},${r.gy}`,
    "keys",
    r.playerState.keys,
    "fires",
    r.monsters.filter((m) => m.alive && m.kind === "fireball").map((f) => `${f.x},${f.y}`).join(" "),
  );
}

// After key-first success, continue to toggle+door+end
const keyFirstFull: Action[] = [
  "down","left","left","left","left","left","left","up","up","up",
];
const kf = sim(keyFirstFull);
console.log("keyFirstFull", {
  keys: kf.r.playerState.keys,
  died: kf.r.playerDied,
  death: kf.r.deathMessage,
  rem: msSecondsRemaining(100, kf.r.buttonPressCtx.moveBoundary),
});

if (kf.r.playerState.keys.some((k) => k.includes("red")) && !kf.r.playerDied) {
  // go open toggle then door then browns
  for (let w = 0; w <= 8; w++) {
    const actions: Action[] = [
      ...keyFirstFull,
      ...Array<Action>(w).fill("wait"),
      "down","down","down",
      "right","right","right","right","right","right","right",
      "up","up","up","up","up","up","up",
      "left","left","left","left","left", // open
      "left","left","up", // toward door — toggle open, may need close
      "up", // door
      "up","left","up","right","right","right",
      "left","left","left","up","up","up","right","right","right",
      "wait","wait","wait",
      "left","left","left","up","up","left","left",
    ];
    const { r, letters } = sim(actions);
    if (r.completed) {
      const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
      console.log("keyFirst WIN w", w, "rem", rem, "ticks", r.buttonPressCtx.moveBoundary, "moves", letters.filter((c) => c !== "W").length);
      if (rem === 85) {
        writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
        console.log("EXACT", letters.join(""));
      }
    } else if (w <= 2) {
      console.log("keyFirst fail w", w, r.deathMessage, `${r.gx},${r.gy}`);
    }
  }
}
