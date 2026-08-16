import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
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
const letters =
  "DLLLDULLUULLUULLUURDLDRRDDRRDDRRRDDDDDDDLDDRRDDRRURDLLLUULLUURUUUUUUURRRRRRRRRRRUUULLDDLLUUUURRURDLLLDDDDRRUURRDDDLLLLLLLLLDDUUUUUUUUUUUUUUUUUUULLLLLLLLLLLLLLRRRRRRRRRRRRRRDDDDDDDDDDDDDDDLLLLRRUUUUUUUUUUUUULLLLLLLLLLLLRRRRRRRRRRRRDDDDDDDDDDDDDRRRRRRLLUUUUUUUUUUUUURRRRRRRRRRRR";
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const a of decodeSolutionMoves([...letters])) {
  if (a === "wait") stepMsCc1Wait(r);
  else stepMsCc1Simulation(r, a as Direction);
}
for (let y = 18; y <= 30; y++) {
  for (const x of [27, 28, 29, 30, 31]) {
    console.log(
      `${x},${y}`,
      "c",
      getCompositeTile(r.level, x, y),
      "u",
      cellTile(r.level, "upper", x, y),
      "l",
      cellTile(r.level, "lower", x, y),
      "f",
      getForceFloorTileAt(r.level, x, y),
    );
  }
}
