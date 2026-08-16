import { readFileSync, writeFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
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

function simulate(actions: Action[]) {
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

const base: Action[] = [
  // trap + key
  "up","up","right","up","up","up","up",
  "left","left","left","left","left","left","left","right","right",
  "right","right","right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
  // to door
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left","up",
  // brown2 first (glider parked on 18,10), then brown1
  "up","left","up", // 13,10
  "right","right","right", // 16,10
  "left","left","left", // 13,10
  "up","up","up", // 13,7
  "right","right","right", // 16,7
];

const afterBrowns = simulate(base);
console.log("after browns", {
  pos: `${afterBrowns.r.gx},${afterBrowns.r.gy}`,
  rem: msSecondsRemaining(100, afterBrowns.r.buttonPressCtx.moveBoundary),
  ticks: afterBrowns.r.buttonPressCtx.moveBoundary,
  t7: isTrapOpen(afterBrowns.r.buttonPressCtx, 18, 7),
  t10: isTrapOpen(afterBrowns.r.buttonPressCtx, 18, 10),
  bomb: getCompositeTile(afterBrowns.r.level, 12, 5),
  glider: afterBrowns.r.monsters.find((m) => m.alive && m.kind === "ghost"),
  died: afterBrowns.r.playerDied,
});

// From 16,7 go toward exit while waiting for bomb
for (let waitBefore = 0; waitBefore <= 20; waitBefore++) {
  const actions: Action[] = [
    ...base,
    ...Array<Action>(waitBefore).fill("wait"),
    "left","left","left","up","up","left","left",
  ];
  const { r, letters } = simulate(actions);
  if (r.completed) {
    const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
    console.log("win waits", waitBefore, "rem", rem, "ticks", r.buttonPressCtx.moveBoundary, "moves", letters.filter((c) => c !== "W").length);
    if (rem === 85) {
      writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
      console.log("EXACT BOLD", letters.join(""));
      break;
    }
    if (rem >= 83) {
      writeFileSync(`scripts/level005-rem${rem}.json`, JSON.stringify(letters) + "\n");
    }
  }
}

// Also try: leave brown1 toward exit immediately with interleaved waits
for (let w1 = 0; w1 <= 8; w1++) {
  for (let w2 = 0; w2 <= 8; w2++) {
    const actions: Action[] = [
      ...base,
      ...Array<Action>(w1).fill("wait"),
      "left","left","left",
      ...Array<Action>(w2).fill("wait"),
      "up","up","left","left",
    ];
    const { r, letters } = simulate(actions);
    if (r.completed) {
      const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
      if (rem >= 84) {
        console.log("combo", w1, w2, "rem", rem, "ticks", r.buttonPressCtx.moveBoundary);
      }
      if (rem === 85) {
        writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
        console.log("EXACT BOLD", letters.join(""));
        process.exit(0);
      }
    }
  }
}
