import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const saved = JSON.parse(readFileSync(".tmp/level015-bold-letters.json", "utf8")) as {
  letters: string[];
};
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of saved.letters) {
  if (ch === "W") stepMsCc1Wait(start);
  else
    stepMsCc1Simulation(
      start,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
}

function blockPos(r: typeof start) {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "none";
}

console.log("start block", blockPos(start), "d11", cellTile(start.level, "upper", 16, 11));
for (let y = 9; y <= 16; y++) {
  let row = "";
  for (let x = 14; x <= 21; x++) {
    const c = getCompositeTile(start.level, x, y);
    const mark = x === start.gx && y === start.gy ? "@" : "";
    const short =
      c === "floor"
        ? "."
        : c === "wall"
          ? "#"
          : c === "block_movable"
            ? "B"
            : c === "door_blue"
              ? "D"
              : c === "door_red"
                ? "R"
                : c === "button_brown"
                  ? "o"
                  : c === "socket"
                    ? "S"
                    : c === "trap"
                      ? "t"
                      : c === "exit"
                        ? "X"
                        : c === "ice"
                          ? "I"
                          : c === "water"
                            ? "~"
                            : c[0]?.toUpperCase() ?? "?";
    row += (mark + short).padStart(2, " ");
  }
  console.log(String(y).padStart(2), row);
}

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
const q = [start];
const seen = new Set<string>();
const k = (r: Runner) => `${r.gx},${r.gy}|${r.playerState.keys.join("+")}|${blockPos(r)}|${cellTile(r.level, "upper", 16, 11)}`;
seen.add(k(start));
let qi = 0;
const blockPositions = new Set<string>([blockPos(start)]);
while (qi < q.length && qi < 100000) {
  const r = q[qi++]!;
  const bp = blockPos(r);
  if (!blockPositions.has(bp)) {
    blockPositions.add(bp);
    console.log("new block", bp, "chip", [r.gx, r.gy], "keys", r.playerState.keys, "d11", cellTile(r.level, "upper", 16, 11));
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const key = k(n);
    if (seen.has(key)) continue;
    seen.add(key);
    q.push(n);
  }
}
console.log("all blocks", [...blockPositions], "seen", seen.size);
