/**
 * After 2R, patch (28,6) open and try 2U + flippers + swim.
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

const DIR: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
const DIRS: Direction[] = ["up", "down", "left", "right"];
const LETTER: Record<Direction, string> = { up: "U", down: "D", left: "L", right: "R" };
const to255 = "LUUULLUUURRUUURRUUUURUUURRRUURUURUURRRRURRUURRRRRRR";

function load(patches: [number, number][]): LevelData {
  const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  for (const [x, y] of patches) {
    if (cellTile(level, "upper", x, y) === "wall") setUpperTile(level, x, y, "empty");
  }
  return level;
}

function blocksKey(r: MsCc1SimulationRunner): string {
  const b: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") b.push(`${x},${y}`);
  return b.join(";");
}

function sk(r: MsCc1SimulationRunner): string {
  return `${r.gx},${r.gy}|${r.playerState.tools.join("+")}|${blocksKey(r)}`;
}

function apply(r: MsCc1SimulationRunner, d: Direction): MsCc1SimulationRunner {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n;
}

function bfs(
  start: MsCc1SimulationRunner,
  goal: (r: MsCc1SimulationRunner) => boolean,
  maxPath: number,
  maxNodes: number,
  label: string,
) {
  const q: { r: MsCc1SimulationRunner; path: Direction[] }[] = [{ r: start, path: [] }];
  const seen = new Set([sk(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
    const { r, path } = q.shift()!;
    n++;
    if (goal(r)) {
      console.log(label, "OK", path.map((d) => LETTER[d]).join(""), "len", path.length, "nodes", n);
      return { path, runner: r };
    }
    if (r.playerDied || r.completed || path.length >= maxPath) continue;
    for (const d of DIRS) {
      const nr = apply(r, d);
      if (nr.playerDied) continue;
      if (nr.gx === r.gx && nr.gy === r.gy && !nr.completed) continue;
      const k = sk(nr);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ r: nr, path: [...path, d] });
    }
  }
  console.log(label, "FAIL nodes", n);
  return null;
}

const patches: [number, number][] = [
  [4, 29],
  [28, 6],
];
const level = load(patches);
console.log("(28,6)=", getCompositeTile(level, 28, 6), "(4,29)=", getCompositeTile(level, 4, 29));

let r = createMsCc1SimulationRunner(structuredClone(level));
const path: Direction[] = [];
for (const ch of to255 + "RR") {
  const d = DIR[ch]!;
  r = apply(r, d);
  path.push(d);
}
console.log("after 2R", r.gx, r.gy, "block28,5", getCompositeTile(r.level, 28, 5));

// Go to (28,6) and push UU
const toPush = bfs(r, (x) => x.gx === 28 && x.gy === 6, 20, 50_000, "to-28,6");
if (!toPush) process.exit(1);
for (const d of toPush.path) {
  path.push(d);
  r = apply(r, d);
}
for (const d of ["up", "up"] as Direction[]) {
  path.push(d);
  r = apply(r, d);
}
console.log("after 2U", r.gx, r.gy, "blocks NE", blocksKey(r).split(";").filter((s) => s.startsWith("2")).join(" "));

const toFlip = bfs(r, (x) => x.playerState.tools.includes("flippers"), 50, 200_000, "flippers");
if (!toFlip) process.exit(1);
path.push(...toFlip.path);
r = toFlip.runner;
console.log("flippers", r.gx, r.gy, "mb", r.buttonPressCtx.moveBoundary);

const toExit = bfs(r, (x) => x.completed, 80, 300_000, "exit");
if (!toExit) process.exit(1);
path.push(...toExit.path);
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

// unpatched
{
  const u = createMsCc1SimulationRunner(
    structuredClone(load([])), // no patches
  );
  for (const d of path) stepMsCc1Simulation(u, d);
  console.log("unpatched", {
    completed: u.completed,
    pos: `${u.gx},${u.gy}`,
    rem: msSecondsRemaining(600, u.buttonPressCtx.moveBoundary),
  });
}
