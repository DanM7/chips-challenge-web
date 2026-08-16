/**
 * Compact BFS for Lesson 1 bold route (target ≤85 move ticks → 83s remaining).
 * Opener: StrategyWiki / BitBusters 2L 2U L.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const levelPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
);
const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
normalizeLevelLayers(level);

const W = level.width;
const H = level.height;
const tiles: string[] = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    tiles.push(getCompositeTile(level, x, y));
  }
}

const chipCells: Array<{ x: number; y: number }> = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (tiles[y * W + x] === "chip") {
      chipCells.push({ x, y });
    }
  }
}
console.log(
  "chips",
  chipCells.length,
  chipCells.map((c) => `${c.x},${c.y}`).join(" "),
);

type Keys = { blue: number; red: number; yellow: number; green: number };

function isWall(tile: string): boolean {
  return tile === "wall";
}

function canEnter(
  x: number,
  y: number,
  keys: Keys,
  chipsLeft: number,
  opened: Set<string>,
): boolean {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const key = `${x},${y}`;
  if (opened.has(key)) return true;
  const tile = tiles[y * W + x]!;
  if (
    tile === "empty" ||
    tile === "chip" ||
    tile === "hint" ||
    tile.startsWith("chip_") ||
    tile.startsWith("key_")
  ) {
    return true;
  }
  if (tile === "exit") return chipsLeft === 0;
  if (tile === "socket") return chipsLeft === 0;
  if (tile === "door_blue") return keys.blue > 0;
  if (tile === "door_red") return keys.red > 0;
  if (tile === "door_yellow") return keys.yellow > 0;
  if (tile === "door_green") return keys.green > 0;
  if (isWall(tile)) return false;
  return false;
}

function applyEnter(
  x: number,
  y: number,
  keys: Keys,
  chipMask: number,
  opened: Set<string>,
): { keys: Keys; chipMask: number; opened: Set<string> } {
  const key = `${x},${y}`;
  let nextKeys = { ...keys };
  let nextMask = chipMask;
  const nextOpened = new Set(opened);

  if (opened.has(key)) {
    return { keys: nextKeys, chipMask: nextMask, opened: nextOpened };
  }

  const tile = tiles[y * W + x]!;
  if (tile === "chip") {
    const idx = chipCells.findIndex((c) => c.x === x && c.y === y);
    if (idx >= 0 && (nextMask & (1 << idx)) === 0) {
      nextMask |= 1 << idx;
    }
    nextOpened.add(key);
  } else if (tile === "key_blue") {
    nextKeys.blue += 1;
    nextOpened.add(key);
  } else if (tile === "key_red") {
    nextKeys.red += 1;
    nextOpened.add(key);
  } else if (tile === "key_yellow") {
    nextKeys.yellow += 1;
    nextOpened.add(key);
  } else if (tile === "key_green") {
    nextKeys.green += 1;
    nextOpened.add(key);
  } else if (tile === "door_blue" && nextKeys.blue > 0) {
    nextKeys.blue -= 1;
    nextOpened.add(key);
  } else if (tile === "door_red" && nextKeys.red > 0) {
    nextKeys.red -= 1;
    nextOpened.add(key);
  } else if (tile === "door_yellow" && nextKeys.yellow > 0) {
    nextKeys.yellow -= 1;
    nextOpened.add(key);
  } else if (tile === "door_green" && nextKeys.green > 0) {
    // green key is infinite in MS
    nextOpened.add(key);
  }

  return { keys: nextKeys, chipMask: nextMask, opened: nextOpened };
}

function chipsLeft(mask: number): number {
  return chipCells.length - popcount(mask);
}

function popcount(n: number): number {
  let c = 0;
  while (n) {
    c += n & 1;
    n >>>= 1;
  }
  return c;
}

function openedKey(opened: Set<string>): string {
  return [...opened].sort().join(";");
}

function stateKey(
  x: number,
  y: number,
  mask: number,
  keys: Keys,
  opened: Set<string>,
): string {
  return `${x},${y}|${mask}|${keys.blue},${keys.red},${keys.yellow},${keys.green}|${openedKey(opened)}`;
}

const DIRS: Array<{ d: Direction; dx: number; dy: number; L: string }> = [
  { d: "left", dx: -1, dy: 0, L: "L" },
  { d: "right", dx: 1, dy: 0, L: "R" },
  { d: "up", dx: 0, dy: -1, L: "U" },
  { d: "down", dx: 0, dy: 1, L: "D" },
];

interface Node {
  x: number;
  y: number;
  mask: number;
  keys: Keys;
  opened: Set<string>;
  path: string;
  ticks: number;
}

const startX = level.playerStart!.x;
const startY = level.playerStart!.y;
const opener = "LLUUL";
let sx = startX;
let sy = startY;
let smask = 0;
let skeys: Keys = { blue: 0, red: 0, yellow: 0, green: 0 };
let sopened = new Set<string>();

for (const L of opener) {
  const dir = DIRS.find((d) => d.L === L)!;
  const nx = sx + dir.dx;
  const ny = sy + dir.dy;
  if (!canEnter(nx, ny, skeys, chipsLeft(smask), sopened)) {
    throw new Error(`opener blocked at ${L} from ${sx},${sy}`);
  }
  const applied = applyEnter(nx, ny, skeys, smask, sopened);
  sx = nx;
  sy = ny;
  smask = applied.chipMask;
  skeys = applied.keys;
  sopened = applied.opened;
}

console.log("after opener", { sx, sy, chipsLeft: chipsLeft(smask), skeys, ticks: opener.length });

const queue: Node[] = [
  {
    x: sx,
    y: sy,
    mask: smask,
    keys: skeys,
    opened: sopened,
    path: opener,
    ticks: opener.length,
  },
];
const seen = new Set<string>([stateKey(sx, sy, smask, skeys, sopened)]);
const maxTicks = 85;
let best: Node | null = null;
let expanded = 0;

while (queue.length > 0) {
  const node = queue.shift()!;
  expanded += 1;
  if (expanded % 50000 === 0) {
    console.log("expanded", expanded, "queue", queue.length, "best", best?.ticks);
  }

  for (const dir of DIRS) {
    const nx = node.x + dir.dx;
    const ny = node.y + dir.dy;
    const left = chipsLeft(node.mask);
    if (!canEnter(nx, ny, node.keys, left, node.opened)) continue;

    const applied = applyEnter(nx, ny, node.keys, node.mask, node.opened);
    const ticks = node.ticks + 1;
    if (ticks > maxTicks) continue;

    const tile = tiles[ny * W + nx]!;
    const atExit = tile === "exit" && chipsLeft(applied.chipMask) === 0;
    const nextPath = node.path + dir.L;

    if (atExit) {
      if (!best || ticks < best.ticks) {
        best = {
          x: nx,
          y: ny,
          mask: applied.chipMask,
          keys: applied.keys,
          opened: applied.opened,
          path: nextPath,
          ticks,
        };
        console.log("FOUND", ticks, msSecondsRemaining(100, ticks), nextPath);
      }
      continue;
    }

    // Through socket toward exit counts as normal floor once chips=0
    const key = stateKey(nx, ny, applied.chipMask, applied.keys, applied.opened);
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({
      x: nx,
      y: ny,
      mask: applied.chipMask,
      keys: applied.keys,
      opened: applied.opened,
      path: nextPath,
      ticks,
    });
  }
}

console.log({ expanded, seen: seen.size, bestTicks: best?.ticks, bestPath: best?.path });

if (!best) {
  process.exit(1);
}

// Verify with real engine sim
const letters = best.path.split("") as Array<"L" | "R" | "U" | "D">;
const dirMap: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};
const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const L of letters) {
  if (stepMsCc1Simulation(runner, dirMap[L]!)) break;
}
const remaining = msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary);
console.log("engine verify", {
  completed: runner.completed,
  died: runner.playerDied,
  ticks: runner.buttonPressCtx.moveBoundary,
  remaining,
  chipMoves: runner.chipMoves,
});

if (runner.completed && remaining >= 83) {
  const out = {
    levelId: "level-001",
    passwordMs: "BDHP",
    title: "Lesson 1",
    timeLimitSeconds: 100,
    boldTimeRemaining: 83,
    minChipMoves: 17,
    moves: encodeSolutionMoves(letters.map((L) => dirMap[L]!)),
    source: "https://scores.bitbusters.club/levels/cc1/1/ms",
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint: "2L 2U L then counterclockwise (compact BFS targeting bold ≤85 ticks)",
    moveVerified: true,
    meetsBoldBudget: remaining >= 83,
    moveSource: `compact BFS from StrategyWiki opener; engine-verified ${remaining}s remaining`,
    simulatedTicks: runner.buttonPressCtx.moveBoundary,
    simulatedSecondsRemaining: remaining,
  };
  writeFileSync(path.join(root, ".tmp/level001-bold-solution.json"), JSON.stringify(out, null, 2));
  console.log("wrote .tmp/level001-bold-solution.json");
}
