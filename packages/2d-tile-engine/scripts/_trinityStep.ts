import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import { tryMsCc1Move } from "../engine/msCc1/msCc1Movement.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-011.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of ["down", "left", "left", "left", "down"] as Direction[]) {
  stepMsCc1Simulation(r, d);
  console.log("open", d, r.gx, r.gy, r.playerDied);
}
for (const d of ["left", "left", "down", "down", "right", "right", "down", "down", "left"] as Direction[]) {
  const before = `${r.gx},${r.gy}`;
  const t10 = {
    comp: getCompositeTile(r.level, r.gx + (d === "right" ? 1 : d === "left" ? -1 : 0), r.gy + (d === "down" ? 1 : d === "up" ? -1 : 0)),
    force: getForceFloorTileAt(
      r.level,
      r.gx + (d === "right" ? 1 : d === "left" ? -1 : 0),
      r.gy + (d === "down" ? 1 : d === "up" ? -1 : 0),
    ),
    upper: cellTile(
      r.level,
      "upper",
      r.gx + (d === "right" ? 1 : d === "left" ? -1 : 0),
      r.gy + (d === "down" ? 1 : d === "up" ? -1 : 0),
    ),
  };
  const mv = tryMsCc1Move(structuredClone(r.level), { x: r.gx, y: r.gy }, d, r.playerState);
  stepMsCc1Simulation(r, d);
  console.log(before, d, "->", `${r.gx},${r.gy}`, "died", r.playerDied, "dest", t10, "tryMs", mv.moved, mv.position);
}
