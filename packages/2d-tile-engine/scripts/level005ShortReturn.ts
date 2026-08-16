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

const toKey: Action[] = [
  "up","up","right","up","up","up","up","left","left","left","left","left",
  "right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
];

// After 4 waits at key: try shorter return via y=18 (2 fewer downs/ups vs y=20)
const shortReturn: Action[] = [
  "wait","wait","wait","wait",
  "down", // 14,18
  "right","right","right","right","right","right","right", // 21,18 — if fire at 15 clear
  "up","up","up","up","up", // 21,13
  "left","left","left","left","left","left","left","up",
  "up","left","up","right","right","right",
  "left","left","left","up","up","up","right","right","right",
];

for (let ew = 0; ew <= 5; ew++) {
  const actions: Action[] = [
    ...toKey,
    ...shortReturn,
    ...Array<Action>(ew).fill("wait"),
    "left","left","left","up","up","left","left",
  ];
  const { r, letters } = sim(actions);
  const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
  console.log("ew", ew, {
    completed: r.completed,
    died: r.playerDied,
    death: r.deathMessage,
    pos: `${r.gx},${r.gy}`,
    rem,
    ticks: r.buttonPressCtx.moveBoundary,
  });
  if (r.completed && rem === 85) {
    writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
    console.log("EXACT", letters.join(""));
  }
}

// Even shorter: from key after waits go D R along 18, but only to 16 then up? walls.
// Or: trap after key grab - from key go back to green to trap, clearing clones, then door
