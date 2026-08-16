import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  readFileSync(path.join(root, "../integration/data/cc1-ms-solutions/level-009.json"), "utf8"),
) as { twsRecords: Array<{ tick: number; direction: number }> };

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const r = createMsCc1SimulationRunner(structuredClone(level));
console.log(
  "start",
  r.gx,
  r.gy,
  getCompositeTile(r.level, r.gx, r.gy),
  "force",
  getForceFloorTileAt(r.level, r.gx, r.gy),
  "monsters",
  r.monsters.length,
);

let prev = 0;
for (let i = 0; i < 40 && i < sol.twsRecords.length; i++) {
  const rec = sol.twsRecords[i]!;
  const dir = TWS_DIR[rec.direction]!;
  const gap = Math.max(0, rec.tick - prev - 1);
  for (let j = 0; j < gap; j++) stepMsCc1Wait(r);
  stepMsCc1Wait(r);
  const before = { x: r.gx, y: r.gy };
  stepMsCc1Simulation(r, dir);
  const nearMonsters = r.monsters
    .filter((m) => Math.abs(m.x - r.gx) + Math.abs(m.y - r.gy) <= 2)
    .map((m) => `${m.kind}@${m.x},${m.y}`)
    .join(";");
  console.log(
    i,
    "tick",
    rec.tick,
    dir,
    `${before.x},${before.y}->${r.gx},${r.gy}`,
    "tile",
    getCompositeTile(r.level, r.gx, r.gy),
    "force",
    getForceFloorTileAt(r.level, r.gx, r.gy),
    "died",
    r.playerDied,
    r.deathMessage ?? "",
    "near",
    nearMonsters || "-",
  );
  if (r.completed || r.playerDied) break;
  prev = rec.tick;
}
