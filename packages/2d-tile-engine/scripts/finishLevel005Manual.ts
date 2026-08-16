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

const route: Action[] = [
  // trap ball + key (38)
  "up","up","right","up","up","up","up",
  "left","left","left","left","left","left","left",
  "right","right",
  "right","right","right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left",
  "up","up","up",
  // around to door (22) + through
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left",
  "up",
  // to brown 16,7 via left corridor
  "up", // 14,11
  "left", // 13,11
  "up","up","up","up", // 13,7
  "right","right","right", // 16,7 brown1
  // to brown 16,10 — down around? bombs at 15-17 rows 8-9,11
  // from 16,7: left to 13,7 then down to 13,10 then right to 16,10
  "left","left","left", // 13,7
  "down","down","down", // 13,10
  "right","right","right", // 16,10 brown2
  // wait for glider to bomb then go to exit
  // glider path: released from traps toward bomb at 12,5
];

function play(actions: Action[], extraWaits = 0) {
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
  for (let i = 0; i < extraWaits && !r.completed && !r.playerDied; i++) {
    stepMsCc1Wait(r);
    letters.push("W");
  }
  return { r, letters };
}

let { r, letters } = play(route);
console.log("after browns", {
  pos: `${r.gx},${r.gy}`,
  completed: r.completed,
  died: r.playerDied,
  death: r.deathMessage,
  rem: msSecondsRemaining(100, r.buttonPressCtx.moveBoundary),
  trap7: isTrapOpen(r.buttonPressCtx, 18, 7),
  trap10: isTrapOpen(r.buttonPressCtx, 18, 10),
  bomb: getCompositeTile(r.level, 12, 5),
  exit: getCompositeTile(r.level, 11, 5),
  glider: r.monsters.find((m) => m.kind === "ghost" && m.alive),
});

// Continue: wait for glider to clear bomb, then go to exit
const finish: Action[] = [];
// From 16,10 back to exit at 11,5
// Path: left to 13,10, up to 13,7, left? wall at 12. 
// Row 7: can go left to 13,7 then... 12 is wall. Need 13,6? row6 is ## at 11-12.
// Exit approach: from north room left side - 13,11 left blocked by wall at 12.
// Looking at map: exit at 11,5, bomb was at 12,5. Room opens at top.
// From 13,7 go up? row6: `##..***..#` x11#,x12#,x13.,x14.
// So 13,6 then left? 12,6 is wall. Up to 13,5: `E*.......#` x11E, x12*, x13.
// So 13,5 then left to 12,5 (bomb or empty) then left to exit!

const toExit: Action[] = [
  "left","left","left", // 13,10
  "up","up","up", // 13,7
  "up", // 13,6
  "up", // 13,5
  "left", // 12,5 bomb cell (hopefully cleared)
  "left", // 11,5 exit
];

// First wait until bomb cleared
for (let w = 0; w < 40; w++) {
  const glider = r.monsters.find((m) => m.kind === "ghost" && m.alive);
  const bomb = getCompositeTile(r.level, 12, 5);
  if (bomb !== "bomb") {
    console.log("bomb cleared after", w, "waits", "glider", glider);
    break;
  }
  stepMsCc1Wait(r);
  letters.push("W");
  if (r.playerDied) {
    console.log("died waiting", r.deathMessage);
    break;
  }
}

for (const a of toExit) {
  if (r.completed || r.playerDied) break;
  stepMsCc1Simulation(r, a);
  letters.push(LETTER[a]);
  console.log("step", a[0], r.gx, r.gy, getCompositeTile(r.level, r.gx, r.gy), r.completed ? "WIN" : "", r.playerDied ? r.deathMessage : "");
}

const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
console.log({
  completed: r.completed,
  died: r.playerDied,
  rem,
  boldExact: rem === 85,
  ticks: r.buttonPressCtx.moveBoundary,
  chipMoves: letters.filter((c) => c !== "W").length,
  waits: letters.filter((c) => c === "W").length,
});

if (r.completed) {
  writeFileSync("scripts/level005-letters.json", JSON.stringify(letters, null, 2) + "\n");
  console.log("wrote letters", letters.join(""));
}
