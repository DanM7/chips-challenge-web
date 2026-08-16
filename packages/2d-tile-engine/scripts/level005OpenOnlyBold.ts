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

const toDoorAndBrowns: Action[] = [
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left","up",
  "up","left","up","right","right","right",
  "left","left","left","up","up","up","right","right","right",
];

const exitVariants: Action[][] = [];
for (let w = 0; w <= 6; w++) {
  exitVariants.push([
    ...Array<Action>(w).fill("wait"),
    "left","left","left","up","up","left","left",
  ]);
  exitVariants.push([
    "left","left","left",
    ...Array<Action>(w).fill("wait"),
    "up","up","left","left",
  ]);
  exitVariants.push([
    "left","left","left","up","up",
    ...Array<Action>(w).fill("wait"),
    "left","left",
  ]);
}

let bestRem = -1;
for (const exit of exitVariants) {
  const actions = [...toKey, ...toDoorAndBrowns, ...exit];
  const { r, letters } = sim(actions);
  if (!r.completed) continue;
  const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
  if (rem > bestRem) bestRem = rem;
  console.log(
    "rem",
    rem,
    "ticks",
    r.buttonPressCtx.moveBoundary,
    "moves",
    letters.filter((c) => c !== "W").length,
    "waits",
    letters.filter((c) => c === "W").length,
    "exit",
    exit.map((a) => (a === "wait" ? "W" : a[0])).join(""),
  );
  if (rem === 85) {
    writeFileSync(
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/_level005-candidate.json",
      JSON.stringify(letters) + "\n",
    );
    writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
    console.log("EXACT BOLD", letters.join(""));
    process.exit(0);
  }
}
console.log("best rem", bestRem);
