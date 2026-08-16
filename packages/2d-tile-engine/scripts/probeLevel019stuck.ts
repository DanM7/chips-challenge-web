import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
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
const dirs = sol.twsRecords
  .map((r) => TWS_DIR[r.direction])
  .filter((d): d is Direction => !!d);

for (const parity of ["odd", "even"] as const) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  let stuck = 0;
  for (let i = 0; i < Math.min(dirs.length, 100); i++) {
    const before = `${r.gx},${r.gy}`;
    stepMsCc1Simulation(r, dirs[i]!);
    const after = `${r.gx},${r.gy}`;
    if (before === after && !r.playerDied) {
      stuck++;
      console.log(`STUCK ${parity} #${i + 1} ${dirs[i]} at ${before} mb=${r.buttonPressCtx.moveBoundary}`);
    }
    if (r.playerDied) {
      console.log(`DEAD ${parity} #${i + 1} at ${after} stucks=${stuck}`);
      break;
    }
  }
}
