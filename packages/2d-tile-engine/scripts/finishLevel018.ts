/**
 * From flippers, manually swim to exit. Prefix = known good path with patches.
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

const PREFIX =
  "LUUULLUUURRUUURRUUUURUUURRRUURUURUURRRRURRUURRRRRRR" + // to 25,5
  "RR" + // 2R
  "DR" + // to 28,6
  "UU" + // 2U
  "RRUUULL"; // to flippers (from prior BFS)

function load(patches: [number, number][]): LevelData {
  const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  for (const [x, y] of patches) {
    if (cellTile(level, "upper", x, y) === "wall") setUpperTile(level, x, y, "empty");
  }
  return level;
}

function applyLetters(level: LevelData, letters: string) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  const path: Direction[] = [];
  for (const ch of letters) {
    const d = DIR[ch];
    if (!d) continue;
    stepMsCc1Simulation(r, d);
    path.push(d);
    if (r.playerDied || r.completed) break;
  }
  return { r, path };
}

function blocksKey(r: MsCc1SimulationRunner): string {
  const b: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") b.push(`${x},${y}`);
  return b.join(";");
}

function sk(r: MsCc1SimulationRunner): string {
  return `${r.gx},${r.gy}|${blocksKey(r)}`;
}

function bfsExit(start: MsCc1SimulationRunner) {
  const q: { r: MsCc1SimulationRunner; path: Direction[] }[] = [{ r: start, path: [] }];
  const seen = new Set([`${start.gx},${start.gy}`]); // pos-only: blocks won't move if we just swim
  let n = 0;
  while (q.length && n < 100_000) {
    const { r, path } = q.shift()!;
    n++;
    if (r.completed) {
      console.log("exit OK", path.map((d) => LETTER[d]).join(""), "len", path.length, "nodes", n);
      return { path, runner: r };
    }
    if (r.playerDied || path.length > 100) continue;
    for (const d of DIRS) {
      const nr = cloneMsCc1SimulationRunner(r);
      stepMsCc1Simulation(nr, d);
      if (nr.playerDied) continue;
      if (nr.gx === r.gx && nr.gy === r.gy && !nr.completed) continue;
      const k = nr.completed ? `done-${path.length}` : `${nr.gx},${nr.gy}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ r: nr, path: [...path, d] });
    }
  }
  console.log("exit FAIL", n, "seen", seen.size);
  return null;
}

const patches: [number, number][] = [
  [4, 29],
  [28, 6],
];
const level = load(patches);
const { r, path } = applyLetters(level, PREFIX);
console.log("after prefix", {
  pos: `${r.gx},${r.gy}`,
  tools: r.playerState.tools,
  mb: r.buttonPressCtx.moveBoundary,
  tile: getCompositeTile(r.level, r.gx, r.gy),
  lower: cellTile(r.level, "lower", r.gx, r.gy),
});

// sketch around chip toward exit
for (let y = r.gy; y <= Math.min(31, r.gy + 12); y++) {
  let row = "";
  for (let x = 10; x <= 30; x++) {
    if (x === r.gx && y === r.gy) row += "C";
    else {
      const t = getCompositeTile(r.level, x, y);
      row +=
        t === "wall"
          ? "#"
          : t === "water"
            ? "~"
            : t === "exit"
              ? "E"
              : t === "socket"
                ? "S"
                : t === "block_blue_wall"
                  ? "b"
                  : t === "block_movable"
                    ? "B"
                    : t === "fire"
                      ? "*"
                      : t === "block_blue_tile"
                        ? "f"
                        : " ";
    }
  }
  console.log(String(y).padStart(2), row);
}

const ex = bfsExit(r);
if (!ex) process.exit(1);

const full = [...path, ...ex.path];
const rem = msSecondsRemaining(600, ex.runner.buttonPressCtx.moveBoundary);
const letters = encodeSolutionMoves(full);
console.log({
  rem,
  mb: ex.runner.buttonPressCtx.moveBoundary,
  moves: letters.length,
  letters: letters.join(""),
  exact553: rem === 553,
});

// Verify on patched
{
  const v = applyLetters(level, letters.join(""));
  console.log("verify patched", {
    completed: v.r.completed,
    rem: msSecondsRemaining(600, v.r.buttonPressCtx.moveBoundary),
  });
}

// Unpatched
{
  const u = applyLetters(load([]), letters.join(""));
  console.log("verify unpatched", {
    completed: u.r.completed,
    pos: `${u.r.gx},${u.r.gy}`,
    rem: msSecondsRemaining(600, u.r.buttonPressCtx.moveBoundary),
  });
}

// Only (4,29) patch
{
  const u = applyLetters(load([[4, 29]]), letters.join(""));
  console.log("verify only-4,29", {
    completed: u.r.completed,
    pos: `${u.r.gx},${u.r.gy}`,
    rem: msSecondsRemaining(600, u.r.buttonPressCtx.moveBoundary),
  });
}
