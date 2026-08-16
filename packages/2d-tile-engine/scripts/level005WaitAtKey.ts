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
    if (r.playerDied || r.completed) break;
  }
  return { r, letters };
}

const toKey: Action[] = [
  "up","up","right","up","up","up","up","left","left","left","left","left",
  "right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
];

const afterDoor: Action[] = [
  "up","left","up","right","right","right",
  "left","left","left","up","up","up","right","right","right",
  "wait","wait","wait","left","left","left","up","up","left","left",
];

const toDoor: Action[] = [
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left","up",
];

for (let w = 0; w <= 20; w++) {
  const leaveKey: Action[] = [
    ...toKey,
    ...Array<Action>(w).fill("wait"),
    ...toDoor,
    ...afterDoor,
  ];
  const { r, letters } = sim(leaveKey);
  const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
  if (r.completed) {
    console.log("WIN wait", w, "rem", rem, "ticks", r.buttonPressCtx.moveBoundary);
    if (rem === 85) {
      writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
      console.log("EXACT", letters.join(""));
      process.exit(0);
    }
  } else if (r.playerDied) {
    if (w <= 5 || w % 5 === 0) {
      console.log("DIE wait", w, r.deathMessage, `${r.gx},${r.gy}`, "rem", rem);
    }
  } else {
    console.log("stuck wait", w, `${r.gx},${r.gy}`, "rem", rem);
  }
}
