/**
 * Waypoint BFS for Castle Moat (in-memory patch of sealing wall at 4,29).
 * Cheap state key: pos + tools + movable block coords.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile, setUpperTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const levelPath =
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json";
const solPath =
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-018.json";

const DIRS: Direction[] = ["up", "down", "left", "right"];
const LETTER: Record<Direction, string> = { up: "U", down: "D", left: "L", right: "R" };

function load(patch: boolean): LevelData {
  const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  if (patch && cellTile(level, "upper", 4, 29) === "wall") {
    setUpperTile(level, 4, 29, "empty");
  }
  return level;
}

function blockFingerprint(r: MsCc1SimulationRunner): string {
  const blocks: string[] = [];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (getCompositeTile(r.level, x, y) === "block_movable") blocks.push(`${x},${y}`);
    }
  }
  return blocks.join(";");
}

function stateKey(r: MsCc1SimulationRunner): string {
  return `${r.gx},${r.gy}|${r.playerState.tools.join("+")}|${blockFingerprint(r)}`;
}

function apply(runner: MsCc1SimulationRunner, d: Direction): MsCc1SimulationRunner {
  const r = cloneMsCc1SimulationRunner(runner);
  stepMsCc1Simulation(r, d);
  return r;
}

function bfs(
  start: MsCc1SimulationRunner,
  goal: (r: MsCc1SimulationRunner) => boolean,
  maxPath: number,
  maxNodes: number,
  label: string,
): { path: Direction[]; runner: MsCc1SimulationRunner } | null {
  const q: { r: MsCc1SimulationRunner; path: Direction[] }[] = [{ r: start, path: [] }];
  const seen = new Set<string>([stateKey(start)]);
  let expanded = 0;
  while (q.length && expanded < maxNodes) {
    const { r, path } = q.shift()!;
    expanded++;
    if (goal(r)) {
      console.log(label, "OK", path.map((d) => LETTER[d]).join(""), "len", path.length, "nodes", expanded);
      return { path, runner: r };
    }
    if (r.playerDied || r.completed || path.length >= maxPath) continue;
    for (const d of DIRS) {
      const nr = apply(r, d);
      if (nr.playerDied) continue;
      if (nr.gx === r.gx && nr.gy === r.gy && !nr.completed) continue;
      const k = stateKey(nr);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ r: nr, path: [...path, d] });
    }
  }
  console.log(label, "FAIL", "nodes", expanded, "seen", seen.size);
  return null;
}

const level = load(true);
const start = createMsCc1SimulationRunner(structuredClone(level));

// 1) Reach west of block (26,5) to set up 2R 2U — stand at (25,5)
const toPushPos = bfs(start, (r) => r.gx === 25 && r.gy === 5, 60, 500_000, "to-25,5");
if (!toPushPos) process.exit(1);

// 2) Execute 2R 2U on the block: R R, then get to (28,6), U U
let r = toPushPos.runner;
let path = [...toPushPos.path];
for (const d of ["right", "right"] as Direction[]) {
  r = apply(r, d);
  path.push(d);
}
console.log("after 2R block26?", getCompositeTile(r.level, 26, 5), "28,5?", getCompositeTile(r.level, 28, 5), "pos", r.gx, r.gy);

// Get south of block at (28,5) → (28,6)
const toSouth = bfs(r, (x) => x.gx === 28 && x.gy === 6, 40, 200_000, "to-28,6");
if (!toSouth) {
  // try (28,4) from north instead — after 2R maybe approach differs
  const alt = bfs(r, (x) => getCompositeTile(x.level, 28, 5) === "block_movable" && (x.gx !== r.gx || x.gy !== r.gy), 20, 100_000, "near-block");
  console.log("alt near", alt?.path.map((d) => LETTER[d]).join(""), alt?.runner.gx, alt?.runner.gy);
  process.exit(1);
}
path = [...path, ...toSouth.path];
r = toSouth.runner;
for (const d of ["up", "up"] as Direction[]) {
  r = apply(r, d);
  path.push(d);
}
console.log("after 2U block at", [...Array(32 * 32)].map((_, i) => {
  const x = i % 32, y = (i / 32) | 0;
  return getCompositeTile(r.level, x, y) === "block_movable" && x >= 25 ? `${x},${y}` : null;
}).filter(Boolean), "pos", r.gx, r.gy);

// 3) Get flippers: push block at (28,1) and step on flippers
const toFlip = bfs(r, (x) => x.playerState.tools.includes("flippers"), 40, 300_000, "flippers");
if (!toFlip) process.exit(1);
path = [...path, ...toFlip.path];
r = toFlip.runner;
console.log("flippers at", r.gx, r.gy, "mb", r.buttonPressCtx.moveBoundary);

// 4) Exit
const toExit = bfs(r, (x) => x.completed, 60, 300_000, "exit");
if (!toExit) process.exit(1);
path = [...path, ...toExit.path];
r = toExit.runner;

const rem = msSecondsRemaining(600, r.buttonPressCtx.moveBoundary);
const letters = encodeSolutionMoves(path);
console.log({
  rem,
  mb: r.buttonPressCtx.moveBoundary,
  moves: letters.length,
  letters: letters.join(""),
  exact553: rem === 553,
});

// Verify unpatched
{
  const u = createMsCc1SimulationRunner(structuredClone(load(false)));
  for (const d of path) stepMsCc1Simulation(u, d);
  console.log("unpatched", { completed: u.completed, pos: `${u.gx},${u.gy}`, rem: msSecondsRemaining(600, u.buttonPressCtx.moveBoundary) });
}

// If patched exact or >= 553, write candidate (won't ship if unpatched fails)
if (r.completed && rem === 553) {
  const existing = JSON.parse(readFileSync(solPath, "utf8"));
  // Only write if unpatched also works — checked above
}
