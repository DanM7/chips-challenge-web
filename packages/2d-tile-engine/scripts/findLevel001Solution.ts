/**
 * Find a completing MS route for level 1 (best-first by chips collected).
 * Run: npx tsx scripts/findLevel001Solution.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs: Direction[] = ["up", "down", "left", "right"];

const level = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../../../cc1-asset-extraction-pipeline/.tmp-level1"),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const chipCells: { x: number; y: number }[] = [];
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    if (getCompositeTile(level, x, y) === "chip") {
      chipCells.push({ x, y });
    }
  }
}

function nearestChipDist(gx: number, gy: number): number {
  let best = 999;
  for (const c of chipCells) {
    const d = Math.abs(c.x - gx) + Math.abs(c.y - gy);
    if (d < best) best = d;
  }
  return best;
}

function priority(runner: ReturnType<typeof createMsCc1SimulationRunner>, depth: number): number {
  const chips = runner.playerState.chipsRemainingOnMap;
  return chips * 100 + nearestChipDist(runner.gx, runner.gy) + depth * 0.01;
}

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };

const start = createMsCc1SimulationRunner(structuredClone(level));
const maxDepth = 120;
const maxNodes = 800_000;

const heap: Frame[] = [{ moves: [], runner: start }];
const seen = new Set<string>([msCc1RunnerStateKey(start)]);
let expanded = 0;
let bestChips = start.playerState.chipsRemainingOnMap;

function popBest(): Frame {
  let bestIdx = 0;
  let bestP = priority(heap[0]!.runner, heap[0]!.moves.length);
  for (let i = 1; i < heap.length; i++) {
    const p = priority(heap[i]!.runner, heap[i]!.moves.length);
    if (p < bestP) {
      bestP = p;
      bestIdx = i;
    }
  }
  const [frame] = heap.splice(bestIdx, 1);
  return frame!;
}

while (heap.length > 0 && expanded < maxNodes) {
  const frame = popBest();
  expanded++;
  if (frame.runner.completed) {
    console.log("SOLVED", frame.moves.length, "moves", "expanded", expanded);
    console.log(JSON.stringify(frame.moves));
    process.exit(0);
  }
  const chips = frame.runner.playerState.chipsRemainingOnMap;
  if (chips < bestChips) {
    bestChips = chips;
    console.log(
      "best chips",
      bestChips,
      "depth",
      frame.moves.length,
      "pos",
      frame.runner.gx,
      frame.runner.gy,
      "keys",
      frame.runner.playerState.keys.join("+") || "-",
    );
  }
  if (frame.moves.length >= maxDepth || frame.runner.playerDied) continue;

  for (const dir of dirs) {
    const next = cloneMsCc1SimulationRunner(frame.runner);
    const beforeKey = msCc1RunnerStateKey(next);
    stepMsCc1Simulation(next, dir);
    if (next.playerDied) continue;
    const afterKey = msCc1RunnerStateKey(next);
    if (afterKey === beforeKey || seen.has(afterKey)) continue;
    seen.add(afterKey);
    heap.push({ moves: [...frame.moves, dir], runner: next });
  }
}

console.log("NO SOLVE", "expanded", expanded, "bestChips", bestChips, "heap", heap.length);
process.exit(1);
