/**
 * Chip-priority search: explores fewer-chips-left states first to find a completing route faster.
 * Run: npx tsx scripts/findLevelSolutionChipFirst.ts <levelNumber>
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
  simulateMsCc1Level,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs: Direction[] = ["up", "down", "left", "right"];

const levelNum = Number.parseInt(process.argv[2] ?? "3", 10);
const levelPath = path.join(
  __dirname,
  `../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(levelNum).padStart(3, "0")}.json`,
);
const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
normalizeLevelLayers(level);

let chipCells = 0;
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    if (getCompositeTile(level, x, y) === "chip") chipCells++;
  }
}

type Frame = {
  moves: Direction[];
  runner: ReturnType<typeof createMsCc1SimulationRunner>;
  priority: number;
};

const startRunner = createMsCc1SimulationRunner(structuredClone(level));
const startChips = startRunner.playerState.chipsRemainingOnMap;
const toolOrder = ["suction_boots", "fire_boots", "flippers", "ice_skates"];
function toolScore(tools: string[]): number {
  return toolOrder.reduce((sum, t) => sum + (tools.includes(t) ? 1 : 0), 0);
}
function framePriority(chips: number, tools: string[], moves: number): number {
  // Prefer collecting all four boots before burning chip count.
  return chips * 1_000 - toolScore(tools) * 100_000 + moves;
}
const maxChipMoves = Math.max(150, chipCells * 40);
const maxNodes = 8_000_000;

const heap: Frame[] = [
  {
    moves: [],
    runner: startRunner,
    priority: framePriority(startChips, startRunner.playerState.tools, 0),
  },
];
const seen = new Set<string>([msCc1RunnerStateKey(startRunner)]);
let expanded = 0;
let bestChips = startChips;

function push(frame: Frame): void {
  let i = heap.length;
  heap.push(frame);
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent]!.priority <= heap[i]!.priority) break;
    [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
    i = parent;
  }
}

function pop(): Frame {
  const top = heap[0]!;
  const last = heap.pop()!;
  if (heap.length === 0) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const left = i * 2 + 1;
    const right = left + 1;
    let smallest = i;
    if (left < heap.length && heap[left]!.priority < heap[smallest]!.priority) smallest = left;
    if (right < heap.length && heap[right]!.priority < heap[smallest]!.priority) smallest = right;
    if (smallest === i) break;
    [heap[i], heap[smallest]] = [heap[smallest]!, heap[i]!];
    i = smallest;
  }
  return top;
}

console.log(`chip-first level ${levelNum}: ${chipCells} chips, max ${maxChipMoves} moves`);

while (heap.length > 0 && expanded < maxNodes) {
  const frame = pop();
  expanded++;

  if (frame.runner.completed) {
    const outPath = path.join(__dirname, `level${String(levelNum).padStart(3, "0")}-solution.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(frame.moves)}\n`);
    const verify = simulateMsCc1Level(structuredClone(level), frame.moves);
    console.log("SOLVED", frame.moves.length, "moves, expanded", expanded, "verified", verify.completed);
    console.log("wrote", outPath);
    process.exit(verify.completed ? 0 : 1);
  }

  const chips = frame.runner.playerState.chipsRemainingOnMap;
  if (chips < bestChips) {
    bestChips = chips;
    console.log("best chips", bestChips, "depth", frame.moves.length, "pos", frame.runner.gx, frame.runner.gy);
  }

  if (frame.moves.length >= maxChipMoves || frame.runner.playerDied) continue;

  for (const dir of dirs) {
    const next = cloneMsCc1SimulationRunner(frame.runner);
    const beforeKey = msCc1RunnerStateKey(next);
    stepMsCc1Simulation(next, dir);
    if (next.playerDied) continue;
    const afterKey = msCc1RunnerStateKey(next);
    if (afterKey === beforeKey || seen.has(afterKey)) continue;
    seen.add(afterKey);
    push({
      moves: [...frame.moves, dir],
      runner: next,
      priority: framePriority(
        next.playerState.chipsRemainingOnMap,
        next.playerState.tools,
        frame.moves.length + 1,
      ),
    });
  }
}

console.log("NO SOLVE", expanded, "bestChips", bestChips);
process.exit(1);
