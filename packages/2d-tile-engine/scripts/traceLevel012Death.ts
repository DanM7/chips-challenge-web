import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = JSON.parse(
  readFileSync("integration/data/cc1-ms-solutions/level-012.json", "utf8"),
);
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];

const runner = createMsCc1SimulationRunner(structuredClone(level));
let prev = 0;
let i = 0;
for (const rec of sol.twsRecords) {
  const dir = TWS_DIR[rec.direction];
  if (!dir) continue;
  const gap = Math.max(0, rec.tick - prev - 1);
  for (let j = 0; j < gap; j++) {
    if (stepMsCc1Wait(runner)) break;
  }
  if (stepMsCc1Wait(runner)) break;
  const before = {
    x: runner.gx,
    y: runner.gy,
    chips: runner.playerState.chipsRemainingOnMap,
    mb: runner.buttonPressCtx.moveBoundary,
  };
  stepMsCc1Simulation(runner, dir);
  i++;
  if (runner.playerDied || runner.completed) {
    console.log("FAIL at move", i, "dir", dir, "from", before, "to", `${runner.gx},${runner.gy}`);
    console.log("death", runner.deathMessage, "tick", rec.tick);
    const near = runner.monsters.filter(
      (m) => Math.abs(m.x - before.x) <= 3 && Math.abs(m.y - before.y) <= 3,
    );
    console.log(
      "monsters near",
      near.map((m) => ({ t: m.type, x: m.x, y: m.y, d: m.direction })),
    );
    break;
  }
  prev = rec.tick;
  if (i % 40 === 0) {
    console.log(
      "ok",
      i,
      `${runner.gx},${runner.gy}`,
      "chips",
      runner.playerState.chipsRemainingOnMap,
      "monsters",
      runner.monsters.length,
    );
  }
}
