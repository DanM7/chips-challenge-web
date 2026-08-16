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

/**
 * Open, key, wait, return via corridor, close toggle (stop clones), door, browns, exit.
 * Closing on the way to door may let us take a tighter exit timing.
 */
const routes: { label: string; actions: Action[] }[] = [];

for (let kw = 4; kw <= 6; kw++) {
  for (let ew = 0; ew <= 5; ew++) {
    routes.push({
      label: `kw${kw}-ew${ew}`,
      actions: [
        "up","up","right","up","up","up","up","left","left","left","left","left",
        "right","right","right","right","right",
        "down","down","down","down","down","down","down",
        "left","left","left","left","left","left","left","up","up","up",
        ...Array<Action>(kw).fill("wait"),
        "down","down","down",
        "right","right","right","right","right","right","right",
        "up","up","up","up","up","up","up",
        // close toggle while ball hopefully west
        "left","left","left","left","left", // on green
        // to door
        "left","left","up",
        "up","left","up","right","right","right",
        "left","left","left","up","up","up","right","right","right",
        ...Array<Action>(ew).fill("wait"),
        "left","left","left","up","up","left","left",
      ],
    });
  }
}

// Also: skip closing, but shave door path by going to door from corridor without re-crossing
for (let kw = 4; kw <= 4; kw++) {
  for (let ew = 0; ew <= 4; ew++) {
    routes.push({
      label: `noclose-kw${kw}-ew${ew}-shortbrown`,
      actions: [
        "up","up","right","up","up","up","up","left","left","left","left","left",
        "right","right","right","right","right",
        "down","down","down","down","down","down","down",
        "left","left","left","left","left","left","left","up","up","up",
        ...Array<Action>(kw).fill("wait"),
        "down","down","down",
        "right","right","right","right","right","right","right",
        "up","up","up","up","up","up","up",
        "left","left","left","left","left","left","left","up",
        // brown2 then brown1 then exit ASAP
        "up","left","up","right","right","right",
        "left","left","left","up","up","up","right","right","right",
        ...Array<Action>(ew).fill("wait"),
        "left","left","left","up","up","left","left",
      ],
    });
  }
}

let best = { rem: -1, label: "" };
for (const route of routes) {
  const { r, letters } = sim(route.actions);
  if (!r.completed) continue;
  const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
  if (rem > best.rem) best = { rem, label: route.label };
  if (rem >= 84) {
    console.log(route.label, "rem", rem, "ticks", r.buttonPressCtx.moveBoundary, "moves", letters.filter((c) => c !== "W").length);
  }
  if (rem === 85) {
    writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
    writeFileSync(
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-005-candidate-moves.json",
      JSON.stringify(letters) + "\n",
    );
    console.log("EXACT BOLD", letters.join(""));
    process.exit(0);
  }
}
console.log("best", best);
