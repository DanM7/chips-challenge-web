/**
 * Shortest chip-collecting path for Digger (ignore teeth), then test with teeth+odd.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const DIRS: Direction[] = ["up", "down", "left", "right"];
const DELTA: Record<Direction, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function isChipTile(t: string | undefined): boolean {
  return !!t && t.startsWith("chip");
}

function canChipWalk(lv: LevelData, x: number, y: number, chipsLeft: number): boolean {
  if (x < 0 || y < 0 || x >= lv.width || y >= lv.height) return false;
  const t = getCompositeTile(lv, x, y) ?? "empty";
  if (t === "wall") return false;
  if (t === "socket" && chipsLeft > 0) return false;
  if (t.includes("frog") || t.includes("teeth")) return true; // ghost mode
  return true;
}

// Ghost BFS: state = pos + set of remaining chips (as bitmask is too big for 146).
// Use chipsRemaining count + level digest of chip layer only — still huge.
// Instead: nearest-chip greedy with BFS between chips.

function chipCells(lv: LevelData): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < lv.height; y++) {
    for (let x = 0; x < lv.width; x++) {
      if (isChipTile(getCompositeTile(lv, x, y))) out.push({ x, y });
    }
  }
  return out;
}

function bfsPath(
  lv: LevelData,
  from: { x: number; y: number },
  to: { x: number; y: number },
  chipsLeft: number,
): Direction[] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const queue: Array<{ x: number; y: number; path: Direction[] }> = [
    { x: from.x, y: from.y, path: [] },
  ];
  const seen = new Set([key(from.x, from.y)]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) return cur.path;
    if (cur.path.length > 80) continue;
    for (const d of DIRS) {
      const [dx, dy] = DELTA[d]!;
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      if (!canChipWalk(lv, nx, ny, chipsLeft)) continue;
      seen.add(k);
      queue.push({ x: nx, y: ny, path: [...cur.path, d] });
    }
  }
  return null;
}

// Greedy nearest chip, then exit
const work = structuredClone(level);
normalizeLevelLayers(work);
let pos = { x: work.playerStart!.x, y: work.playerStart!.y };
let chipsLeft = 146;
const route: Direction[] = [];
const startChips = chipCells(work);
console.log("chips on map", startChips.length);

while (chipsLeft > 0) {
  const chips = chipCells(work);
  let best: { path: Direction[]; cell: { x: number; y: number } } | null = null;
  for (const c of chips) {
    const path = bfsPath(work, pos, c, chipsLeft);
    if (!path) continue;
    if (!best || path.length < best.path.length) best = { path, cell: c };
  }
  if (!best) {
    console.log("stuck greedy at", pos, "chipsLeft", chipsLeft);
    break;
  }
  for (const d of best.path) {
    route.push(d);
    const [dx, dy] = DELTA[d]!;
    pos = { x: pos.x + dx, y: pos.y + dy };
    // collect
    const t = getCompositeTile(work, pos.x, pos.y);
    if (isChipTile(t)) {
      // remove chip
      const i = pos.y * work.width + pos.x;
      if (work.layers.upper[i]?.startsWith("chip")) work.layers.upper[i] = "empty";
      if (work.layers.lower[i]?.startsWith("chip")) work.layers.lower[i] = "empty";
      chipsLeft--;
    }
    if (t === "dirt") {
      work.layers.upper[pos.y * work.width + pos.x] = "empty";
    }
  }
}
// to exit
const toExit = bfsPath(work, pos, { x: 12, y: 15 }, 0);
if (toExit) {
  route.push(...toExit);
  console.log("greedy route length", route.length, "to exit ok");
} else {
  console.log("greedy route length", route.length, "NO path to exit from", pos);
}

// Simulate greedy with teeth
function sim(moves: Direction[], parity: "even" | "odd") {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (let i = 0; i < moves.length; i++) {
    stepMsCc1Simulation(r, moves[i]!);
    if (r.playerDied || r.completed) {
      return {
        parity,
        at: i + 1,
        done: r.completed,
        died: r.playerDied,
        death: r.deathMessage,
        pos: `${r.gx},${r.gy}`,
        chips: r.playerState.chipsRemainingOnMap,
        rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
        mb: r.buttonPressCtx.moveBoundary,
      };
    }
  }
  return {
    parity,
    at: moves.length,
    done: r.completed,
    died: false,
    pos: `${r.gx},${r.gy}`,
    chips: r.playerState.chipsRemainingOnMap,
    rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
    mb: r.buttonPressCtx.moveBoundary,
  };
}

console.log("ghost length would rem", msSecondsRemaining(210, route.length));
console.log("greedy odd", sim(route, "odd"));
console.log("greedy even", sim(route, "even"));
