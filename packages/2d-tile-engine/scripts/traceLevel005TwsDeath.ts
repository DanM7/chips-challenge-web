import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-005.json"), "utf8"),
) as {
  twsRecords: Array<{ tick: number; direction: number }>;
};

const TWS_DIR = ["up", "left", "down", "right"] as const;
const r = createMsCc1SimulationRunner(structuredClone(level));
let prev = 0;
let i = 0;
for (const rec of sol.twsRecords) {
  i += 1;
  const dir = TWS_DIR[rec.direction]!;
  const gap = Math.max(0, rec.tick - prev - 1);
  for (let g = 0; g < gap; g++) stepMsCc1Wait(r);
  stepMsCc1Wait(r);
  if (r.playerDied) {
    console.log("died during wait before move", i, rec);
    break;
  }
  stepMsCc1Simulation(r, dir);
  console.log(
    i,
    "tick",
    rec.tick,
    dir,
    "pos",
    `${r.gx},${r.gy}`,
    "keys",
    r.playerState.keys.join(",") || "-",
    r.playerDied ? `DIED ${r.deathMessage}` : "",
    r.completed ? "WIN" : "",
    "mb",
    r.buttonPressCtx.moveBoundary,
  );
  if (r.playerDied || r.completed) break;
  prev = rec.tick;
}
console.log({
  moves: i,
  rem: msSecondsRemaining(100, r.buttonPressCtx.moveBoundary),
  completed: r.completed,
  died: r.playerDied,
});
