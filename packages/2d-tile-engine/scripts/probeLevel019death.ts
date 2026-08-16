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

const r = createMsCc1SimulationRunner(structuredClone(level));
r.buttonPressCtx.stepParity = "odd";

function mons() {
  return r.monsters
    .filter((m) => m.alive)
    .map((m) => `${m.x},${m.y}${m.direction[0]}`)
    .join(";");
}

for (let i = 0; i < 69; i++) {
  const before = `${r.gx},${r.gy}`;
  const mBefore = mons();
  stepMsCc1Simulation(r, dirs[i]!);
  if (i >= 54 || r.playerDied) {
    console.log(
      `${i + 1} ${dirs[i]![0]!.toUpperCase()} ${before}->${r.gx},${r.gy} mb=${r.buttonPressCtx.moveBoundary} died=${r.playerDied}`,
    );
    console.log(`  before ${mBefore}`);
    console.log(`  after  ${mons()}`);
  }
  if (r.playerDied) break;
}
