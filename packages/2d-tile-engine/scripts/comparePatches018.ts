/**
 * Compare start-corridor patches: shortest path length to (25,5) and flippers approaches.
 */
import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, setUpperTile, cellTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

function base(): LevelData {
  const level = JSON.parse(
    readFileSync(
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json",
      "utf8",
    ),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function passable(level: LevelData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= 32 || y >= 32) return false;
  const t = getCompositeTile(level, x, y);
  if (
    t === "wall" ||
    t === "block_movable" ||
    t === "water" ||
    t === "fire" ||
    t === "bomb" ||
    t === "block_blue_wall" ||
    t.startsWith("blocked")
  )
    return false;
  return true;
}

function shortest(level: LevelData, tx: number, ty: number): number | null {
  const q: { x: number; y: number; d: number }[] = [{ x: 5, y: 30, d: 0 }];
  const seen = new Set(["5,30"]);
  while (q.length) {
    const { x, y, d } = q.shift()!;
    if (x === tx && y === ty) return d;
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !passable(level, nx, ny)) continue;
      seen.add(k);
      q.push({ x: nx, y: ny, d: d + 1 });
    }
  }
  return null;
}

function applyPatch(name: string, cells: [number, number][]) {
  const level = base();
  for (const [x, y] of cells) {
    if (cellTile(level, "upper", x, y) === "wall") setUpperTile(level, x, y, "empty");
  }
  const d255 = shortest(level, 25, 5);
  const d271 = shortest(level, 27, 1);
  const dExit = shortest(level, 23, 25); // near exit outside blue walls
  console.log(name, "to25,5=", d255, "to27,1=", d271, "nearExit=", dExit);
}

applyPatch("none", []);
applyPatch("4,29", [[4, 29]]);
applyPatch("1-3,30", [
  [1, 30],
  [2, 30],
  [3, 30],
]);
applyPatch("1-3,30+4,29", [
  [1, 30],
  [2, 30],
  [3, 30],
  [4, 29],
]);
applyPatch("5,29", [[5, 29]]);
applyPatch("4-6,29", [
  [4, 29],
  [5, 29],
  [6, 29],
]);
applyPatch("left-corridor-full", [
  [1, 30],
  [2, 30],
  [3, 30],
  [4, 29],
  [5, 29],
]);

// Also: maybe thin walls wrongly stored — treat y=29 x=3..8 as passable
{
  const level = base();
  for (let x = 3; x <= 8; x++) setUpperTile(level, x, 29, "empty");
  console.log("clear all y29 barrier to25,5=", shortest(level, 25, 5));
}
