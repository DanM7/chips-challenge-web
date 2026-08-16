import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const r = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < 445; i++) stepMsCc1Simulation(r, tws[i]!);

function blockPos(): string {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "gone";
}

const seq = "LLDLURUULRDDLUUU";
for (const c of seq) {
  const d = c === "U" ? "up" : c === "D" ? "down" : c === "L" ? "left" : "right";
  stepMsCc1Simulation(r, d as Direction);
  console.log(c, {
    pos: `${r.gx},${r.gy}`,
    block: blockPos(),
    blue: cellTile(r.level, "upper", 16, 11),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    died: r.playerDied,
    death: r.deathMessage,
  });
  if (r.playerDied) break;
}
