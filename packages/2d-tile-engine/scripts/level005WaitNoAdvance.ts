import { readFileSync, writeFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { tickMsCc1Monsters } from "../engine/msCc1/msCc1Monsters.js";
import { applyButtonPressAt } from "../engine/msCc1/msCc1Buttons.js";
import type { Direction, LevelData } from "../engine/types.js";

type Action = Direction | "wait";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

function parse(s: string): Direction[] {
  return [...s].map((ch) => {
    if (ch === "U") return "up";
    if (ch === "D") return "down";
    if (ch === "L") return "left";
    return "right";
  });
}

const route: Action[] = [
  ...parse("UURUUUULLLLLRRRRRDDDDDDDLLLLLLLUUU"),
  "wait",
  "wait",
  "wait",
  "wait",
  ...parse("DDDRRURUURRRRUUUULLLLLLLUU"),
  ...parse("URRLLUUURR"),
  "wait",
  "wait",
  "wait",
  ...parse("LLUULLL"),
];

const r = createMsCc1SimulationRunner(structuredClone(level));
let chipMoves = 0;
let waits = 0;
for (const a of route) {
  if (a === "wait") {
    waits += 1;
    const tick = tickMsCc1Monsters(
      r.level,
      r.monsters,
      { x: r.gx, y: r.gy },
      r.playerState.chipsRemainingOnMap,
      (from, to, ch) =>
        applyButtonPressAt(r.level, from, to, r.monsters, ch, r.buttonPressCtx),
      r.buttonPressCtx,
      { advanceTeethBoundary: false },
    );
    if (tick.chipDied) {
      r.playerDied = true;
      r.deathMessage = "Ooops! Look out for creatures!";
      break;
    }
  } else {
    chipMoves += 1;
    stepMsCc1Simulation(r, a);
  }
  if (r.completed || r.playerDied) break;
}

const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
const letters = route.map((a) =>
  a === "wait" ? "W" : a === "up" ? "U" : a === "down" ? "D" : a === "left" ? "L" : "R",
);
console.log({
  completed: r.completed,
  died: r.playerDied,
  death: r.deathMessage,
  chipMoves,
  waits,
  ticks: r.buttonPressCtx.moveBoundary,
  rem,
  boldExact: rem === 85,
});

if (r.completed && rem === 85) {
  writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
  console.log("EXACT BOLD", letters.join(""));
}
