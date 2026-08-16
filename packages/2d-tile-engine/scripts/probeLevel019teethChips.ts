import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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

// Track teeth #1 (starts 16,11) - index in monsters array
const teethIdx = r.monsters.findIndex((m) => m.x === 16 && m.y === 11);
console.log("tracking teeth", teethIdx, r.monsters[teethIdx]);

for (let i = 0; i < 68; i++) {
  const t = r.monsters[teethIdx]!;
  const tileUnder = getCompositeTile(r.level, t.x, t.y);
  stepMsCc1Simulation(r, dirs[i]!);
  const t2 = r.monsters[teethIdx]!;
  if (t.x !== t2.x || t.y !== t2.y) {
    const destTile = getCompositeTile(r.level, t2.x, t2.y);
    // Check if destination HAD a chip before this step - approximate via chips remaining drop without chip at chip pos
    console.log(
      `mb${r.buttonPressCtx.moveBoundary}: teeth ${t.x},${t.y}->${t2.x},${t2.y} nowTile=${destTile} chipPosWas=${tileUnder}`,
    );
  }
  if (r.playerDied) break;
}

// Also: after prefix, are there chips on row 7 that teeth walked through?
console.log("\nRow 7 tiles after death-prefix:");
const r2 = createMsCc1SimulationRunner(structuredClone(level));
r2.buttonPressCtx.stepParity = "odd";
const prefix = dirs.slice(0, 68);
for (const d of prefix) stepMsCc1Simulation(r2, d);
for (let x = 0; x < 32; x++) {
  const t = getCompositeTile(r2.level, x, 7);
  if (t && t !== "wall" && t !== "empty" && t !== "dirt") console.log(x, 7, t);
}
