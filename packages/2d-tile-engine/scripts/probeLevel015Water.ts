/**
 * Maze follower for water section using Wikibooks intersection list.
 * From after NW at (10,12) with flippers+suction+red key.
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

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

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction;

const prefix = [
  ..."LLLLDDDLLLLLLULURRRRR".split("").map((c) =>
    c === "L" ? "left" : c === "R" ? "right" : c === "U" ? "up" : "down",
  ),
  ..."LLLDDRRRRRUUUUUULLLLLLDLDRRRRR".split("").map((c) =>
    c === "L" ? "left" : c === "R" ? "right" : c === "U" ? "up" : "down",
  ),
] as Direction[];

function apply(r: Runner, seq: Direction[]) {
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
}

const r = createMsCc1SimulationRunner(structuredClone(level));
apply(r, prefix);
console.log("start water from", {
  pos: { x: r.gx, y: r.gy },
  keys: r.playerState.keys,
  tools: r.playerState.tools,
});

// Dump water area
console.log("WATER MAP (lower-left):");
for (let y = 16; y <= 30; y++) {
  let row = "";
  for (let x = 1; x <= 14; x++) {
    const t = getCompositeTile(r.level, x, y);
    const mark =
      r.gx === x && r.gy === y
        ? "@"
        : t === "water"
          ? "~"
          : t === "wall"
            ? "#"
            : t === "chip"
              ? "c"
              : t === "key_blue"
                ? "b"
                : t === "door_red"
                  ? "R"
                  : t === "empty"
                    ? "."
                    : t[0];
    row += mark;
  }
  console.log(String(y).padStart(2), row);
}

// Find red doors still present
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++)
    if (cellTile(r.level, "upper", x, y) === "door_red")
      console.log("door_red", x, y);
