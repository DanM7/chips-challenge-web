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

function run(actions: Action[], label: string) {
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
  // Wait for bomb if needed then finish if not done
  if (!r.completed && !r.playerDied && getCompositeTile(r.level, 12, 5) === "bomb") {
    for (let w = 0; w < 30; w++) {
      if (getCompositeTile(r.level, 12, 5) !== "bomb") break;
      stepMsCc1Wait(r);
      letters.push("W");
      if (r.playerDied) break;
    }
  }
  if (!r.completed && !r.playerDied && r.gx === 16 && r.gy === 10) {
    const finish: Direction[] = [
      "left","left","left","up","up","up","up","up","left","left",
    ];
    for (const d of finish) {
      stepMsCc1Simulation(r, d);
      letters.push(LETTER[d]);
      if (r.completed || r.playerDied) break;
    }
  }
  const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
  console.log(label, {
    completed: r.completed,
    died: r.playerDied,
    death: r.deathMessage,
    pos: `${r.gx},${r.gy}`,
    rem,
    ticks: r.buttonPressCtx.moveBoundary,
    bomb: getCompositeTile(r.level, 12, 5),
    moves: letters.filter((c) => c !== "W").length,
    waits: letters.filter((c) => c === "W").length,
  });
  if (r.completed && rem === 85) {
    writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
    console.log("EXACT BOLD", letters.join(""));
  } else if (r.completed) {
    writeFileSync(`scripts/level005-rem${rem}.json`, JSON.stringify(letters) + "\n");
  }
  return rem;
}

/** Compact StrategyWiki-style route candidates. */
const candidates: { label: string; route: Action[] }[] = [
  {
    label: "v1-trap-full",
    route: [
      "up","up","right","up","up","up","up",
      "left","left","left","left","left","left","left","right","right",
      "right","right","right","right","right","right","right",
      "down","down","down","down","down","down","down",
      "left","left","left","left","left","left","left","up","up","up",
      "down","down","down",
      "right","right","right","right","right","right","right",
      "up","up","up","up","up","up","up",
      "left","left","left","left","left","left","left","up",
      "up","left","up","up","up","up","right","right","right",
      "left","left","left","down","down","down","right","right","right",
    ],
  },
  {
    label: "v2-no-second-toggle",
    // open toggle once, rush key before too many fireballs
    route: [
      "up","up","right","up","up","up","up",
      "left","left","left","left","left", // green open
      "right","right","right","right","right",
      "down","down","down","down","down","down","down",
      "left","left","left","left","left","left","left","up","up","up",
      "down","down","down",
      "right","right","right","right","right","right","right",
      "up","up","up","up","up","up","up",
      "left","left","left","left","left","left","left","up",
      "up","left","up","up","up","up","right","right","right",
      "left","left","left","down","down","down","right","right","right",
    ],
  },
  {
    label: "v3-east-brown2",
    route: [
      "up","up","right","up","up","up","up",
      "left","left","left","left","left","left","left","right","right",
      "right","right","right","right","right","right","right",
      "down","down","down","down","down","down","down",
      "left","left","left","left","left","left","left","up","up","up",
      "down","down","down",
      "right","right","right","right","right","right","right",
      "up","up","up","up","up","up","up",
      "left","left","left","left","left","left","left","up",
      "up","left","up","up","up","up","right","right","right", // brown1
      "right","right","right", // 19,7
      "down","down","down", // 19,10
      "left","left","left", // 16,10 brown2
    ],
  },
];

for (const c of candidates) {
  run(c.route, c.label);
}
