import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { direction: number }[] };
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};
const dirs = sol.twsRecords
  .map((r) => TWS_DIR[r.direction])
  .filter((d): d is Direction => !!d);

for (const parity of ["odd", "even"] as const) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (let i = 0; i < dirs.length; i++) {
    stepMsCc1Simulation(r, dirs[i]!);
    if (r.playerDied || r.completed) {
      const rem = msSecondsRemaining(210, r.buttonPressCtx.moveBoundary);
      console.log({
        parity,
        result: r.completed ? "WIN" : "DIE",
        at: i + 1,
        pos: `${r.gx},${r.gy}`,
        chips: r.playerState.chipsRemainingOnMap,
        mb: r.buttonPressCtx.moveBoundary,
        rem,
        death: r.deathMessage,
        boldExact: rem === 171,
      });
      break;
    }
  }
  if (!r.playerDied && !r.completed) {
    console.log(parity, "incomplete", `${r.gx},${r.gy}`, r.playerState.chipsRemainingOnMap);
  }
}

// Also try SW-ish shorter route for bold 171 once TWS works
