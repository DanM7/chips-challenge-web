/**
 * Castle Moat bold finder — patches suspected sealing wall at (4,29) in-memory only.
 */
import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile, setUpperTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const levelPath =
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json";

const DIRS: Direction[] = ["up", "down", "left", "right"];
const LETTER: Record<Direction, string> = { up: "U", down: "D", left: "L", right: "R" };

function load(patch429: boolean): LevelData {
  const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  if (patch429 && cellTile(level, "upper", 4, 29) === "wall") {
    setUpperTile(level, 4, 29, "empty");
  }
  return level;
}

function apply(runner: MsCc1SimulationRunner, d: Direction): MsCc1SimulationRunner {
  const r = cloneMsCc1SimulationRunner(runner);
  stepMsCc1Simulation(r, d);
  return r;
}

function hasFlippers(r: MsCc1SimulationRunner): boolean {
  return r.playerState.tools.includes("flippers");
}

function bfsTo(
  start: MsCc1SimulationRunner,
  goal: (r: MsCc1SimulationRunner) => boolean,
  opts: { maxNodes?: number; maxPath?: number; label?: string } = {},
): { path: Direction[]; runner: MsCc1SimulationRunner } | null {
  const maxNodes = opts.maxNodes ?? 2_000_000;
  const maxPath = opts.maxPath ?? 120;
  const q: { r: MsCc1SimulationRunner; path: Direction[] }[] = [{ r: start, path: [] }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let expanded = 0;
  while (q.length && expanded < maxNodes) {
    const { r, path } = q.shift()!;
    expanded++;
    if (goal(r)) {
      console.log(opts.label ?? "goal", "found", path.length, "nodes", expanded, "pos", r.gx, r.gy);
      return { path, runner: r };
    }
    if (r.playerDied || r.completed || path.length >= maxPath) continue;
    for (const d of DIRS) {
      const nr = apply(r, d);
      if (nr.playerDied) continue;
      if (nr.gx === r.gx && nr.gy === r.gy && !nr.completed) continue;
      const key = msCc1RunnerStateKey(nr);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ r: nr, path: [...path, d] });
    }
  }
  console.log(opts.label ?? "goal", "FAIL nodes", expanded, "seen", seen.size);
  return null;
}

console.log("unpatched neighbors:");
{
  const start = createMsCc1SimulationRunner(structuredClone(load(false)));
  for (const d of DIRS) {
    const nr = apply(start, d);
    console.log(d, nr.gx, nr.gy, "mb", nr.buttonPressCtx.moveBoundary);
  }
}

const level = load(true);
console.log("patched (4,29)=", getCompositeTile(level, 4, 29));
const start = createMsCc1SimulationRunner(structuredClone(level));

const toFlip = bfsTo(start, (r) => hasFlippers(r), {
  maxNodes: 3_000_000,
  maxPath: 80,
  label: "flippers",
});

if (!toFlip) {
  console.log("Cannot reach flippers");
  process.exit(1);
}

console.log(
  "after flippers",
  toFlip.runner.gx,
  toFlip.runner.gy,
  "mb",
  toFlip.runner.buttonPressCtx.moveBoundary,
  "path",
  toFlip.path.map((d) => LETTER[d]).join(""),
);

const toExit = bfsTo(toFlip.runner, (r) => r.completed, {
  maxNodes: 2_000_000,
  maxPath: 80,
  label: "exit",
});

if (!toExit) {
  console.log("Cannot reach exit");
  process.exit(1);
}

const fullPath = [...toFlip.path, ...toExit.path];
const rem = msSecondsRemaining(600, toExit.runner.buttonPressCtx.moveBoundary);
const mb = toExit.runner.buttonPressCtx.moveBoundary;
const letters = encodeSolutionMoves(fullPath);
console.log({
  moves: letters.length,
  letters: letters.join(""),
  mb,
  rem,
  exact553: rem === 553,
  pathFlip: toFlip.path.length,
  pathExit: toExit.path.length,
});

{
  const r = createMsCc1SimulationRunner(structuredClone(load(false)));
  for (const d of fullPath) stepMsCc1Simulation(r, d);
  console.log("unpatched replay", {
    completed: r.completed,
    pos: `${r.gx},${r.gy}`,
    rem: msSecondsRemaining(600, r.buttonPressCtx.moveBoundary),
  });
}
