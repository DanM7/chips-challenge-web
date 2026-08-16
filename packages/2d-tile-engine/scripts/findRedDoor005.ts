import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

for (let y = 11; y <= 14; y++) {
  for (let x = 12; x <= 22; x++) {
    const t = getCompositeTile(level, x, y);
    if (t && t !== "empty" && t !== "wall") console.log(x, y, t);
    if (t === "wall" && y === 12) console.log(x, y, "wall");
  }
}

const prefix: Direction[] = [
  "up","up","right","up","up","up","up",
  "left","left","left","left","left","left","left",
  "right","right",
  "right","right","right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left",
  "up","up","up",
];
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of prefix) stepMsCc1Simulation(r, d);
console.log("at key", r.gx, r.gy, r.playerState.keys);

// Try go to door - from map, red lock might be at 14,12 area
const tryPath: Direction[] = [
  "up","up","up","up","up", // toward y=12
];
for (const d of tryPath) {
  const b = `${r.gx},${r.gy}`;
  stepMsCc1Simulation(r, d);
  console.log(d[0], b, "->", `${r.gx},${r.gy}`, getCompositeTile(r.level, r.gx, r.gy), r.playerDied ? r.deathMessage : "", "keys", r.playerState.keys);
  if (r.playerDied) break;
}
