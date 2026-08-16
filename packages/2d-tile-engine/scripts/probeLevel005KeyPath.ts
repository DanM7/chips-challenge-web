import { readFileSync } from "fs";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const prefix: Direction[] = [
  "up",
  "up",
  "right",
  "up",
  "up",
  "up",
  "up",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
  "right",
  "right",
];

let r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of prefix) stepMsCc1Simulation(r, d);
console.log("after prefix", r.gx, r.gy, getCompositeTile(r.level, 16, 15));
console.log(
  "ball",
  r.monsters.find((m) => m.kind === "ball_pink"),
);
console.log(
  "fires",
  r.monsters.filter((m) => m.alive && m.kind === "fireball"),
);

// Try path to key: R to corridor, D to bottom, L under fire, U to key
const toKey: Direction[] = [
  "right",
  "right",
  "right",
  "right",
  "right", // 21,13
  "down",
  "down",
  "down",
  "down",
  "down",
  "down",
  "down", // 21,20
  "left",
  "left",
  "left",
  "left",
  "left",
  "left",
  "left", // 14,20
  "up",
  "up",
  "up", // 14,17 key
];

for (const d of toKey) {
  const before = `${r.gx},${r.gy}`;
  stepMsCc1Simulation(r, d);
  console.log(
    d[0],
    before,
    "->",
    `${r.gx},${r.gy}`,
    r.playerDied ? r.deathMessage : "",
    "tile",
    getCompositeTile(r.level, r.gx, r.gy),
    "keys",
    r.playerState.keys,
  );
  if (r.playerDied) break;
}
