/**
 * Static reachability + short manual routes toward Castle Moat flippers.
 */
import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile, setUpperTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
setUpperTile(level, 4, 29, "empty");

function passable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= 32 || y >= 32) return false;
  const t = getCompositeTile(level, x, y);
  if (t === "wall" || t === "block_movable" || t === "water" || t === "fire" || t === "bomb") return false;
  if (t.startsWith("blocked")) return false;
  if (t === "block_blue_wall") return false; // real blue walls
  return true;
}

// BFS static from start
const start = { x: 5, y: 30 };
const prev = new Map<string, string | null>();
const q = [start];
prev.set("5,30", null);
while (q.length) {
  const { x, y } = q.shift()!;
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ]) {
    const nx = x + dx,
      ny = y + dy;
    const k = `${nx},${ny}`;
    if (prev.has(k) || !passable(nx, ny)) continue;
    // also allow standing on chip marker
    prev.set(k, `${x},${y}`);
    q.push({ x: nx, y: ny });
  }
}
console.log("reachable cells", prev.size);
for (const target of ["25,5", "27,5", "24,5", "26,4", "26,6", "27,1", "29,1", "28,2", "22,2", "23,6", "14,4"]) {
  console.log("reach", target, prev.has(target));
}

function pathTo(tx: number, ty: number): string | null {
  const key = `${tx},${ty}`;
  if (!prev.has(key)) return null;
  const dirs: string[] = [];
  let cur: string | null = key;
  while (cur && cur !== "5,30") {
    const p = prev.get(cur)!;
    if (!p) break;
    const [cx, cy] = cur.split(",").map(Number);
    const [px, py] = p.split(",").map(Number);
    if (cx === px + 1) dirs.push("R");
    else if (cx === px - 1) dirs.push("L");
    else if (cy === py + 1) dirs.push("D");
    else if (cy === py - 1) dirs.push("U");
    cur = p;
  }
  return dirs.reverse().join("");
}

// Nearest approach cells to block 26,5
for (const [x, y] of [
  [25, 5],
  [27, 5],
  [26, 4],
  [26, 6],
  [24, 5],
  [23, 5],
  [25, 4],
  [25, 6],
  [27, 1],
  [29, 1],
  [30, 1],
  [27, 2],
  [29, 2],
  [22, 3],
  [21, 2],
  [22, 1],
]) {
  const p = pathTo(x, y);
  console.log(`path to ${x},${y}:`, p ? `${p.length} ${p}` : "UNREACHABLE");
}

// Show what's around (26,5)
console.log("\nAround 26,5:");
for (let y = 3; y <= 8; y++) {
  let row = "";
  for (let x = 20; x <= 31; x++) {
    const t = getCompositeTile(level, x, y);
    if (x === 26 && y === 5) row += "B";
    else if (x === 28 && y === 1) row += "F";
    else
      row +=
        t === "wall"
          ? "#"
          : t === "block_movable"
            ? "b"
            : t === "water"
              ? "~"
              : t === "flippers"
                ? "f"
                : " ";
  }
  console.log(y, row);
}

console.log("\nFull NE corner:");
for (let y = 0; y <= 8; y++) {
  let row = "";
  for (let x = 20; x <= 31; x++) {
    const t = getCompositeTile(level, x, y);
    row +=
      t === "wall"
        ? "#"
        : t === "block_movable"
          ? "B"
          : t === "water"
            ? "~"
            : t === "flippers"
              ? "F"
              : " ";
  }
  console.log(y, row);
}

// Left maze connectivity toward NE - find cells near x>=20 y<=10 that are reachable
const ne = [...prev.keys()].filter((k) => {
  const [x, y] = k.split(",").map(Number);
  return x >= 18 && y <= 12;
});
console.log("reachable NE-ish", ne.sort().join(" "));
