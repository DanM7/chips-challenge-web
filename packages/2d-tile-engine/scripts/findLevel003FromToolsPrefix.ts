/**
 * Level 3 suffix with chip-priority from all-tools prefix.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  simulateMsCc1Level,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs: Direction[] = ["up", "down", "left", "right"];
const toolsPrefix: Direction[] = [
  "down", "right", "up", "up", "up", "up", "left", "up", "down", "down",
  "left", "left", "left", "down", "up", "right", "right", "down", "right",
  "right", "right", "right", "right",
];

const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-003.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of toolsPrefix) stepMsCc1Simulation(start, m);

type Frame = { moves: Direction[]; runner: typeof start; priority: number };
const heap: Frame[] = [{ moves: [], runner: start, priority: start.playerState.chipsRemainingOnMap * 10_000 }];
const seen = new Set<string>([msCc1RunnerStateKey(start)]);
let expanded = 0;
let bestChips = start.playerState.chipsRemainingOnMap;

function push(f: Frame): void {
  let i = heap.length;
  heap.push(f);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p]!.priority <= heap[i]!.priority) break;
    [heap[p], heap[i]] = [heap[i]!, heap[p]!];
    i = p;
  }
}
function pop(): Frame {
  const top = heap[0]!;
  const last = heap.pop()!;
  if (!heap.length) return top;
  heap[0] = last;
  let i = 0;
  for (;;) {
    const l = i * 2 + 1;
    const r = l + 1;
    let s = i;
    if (l < heap.length && heap[l]!.priority < heap[s]!.priority) s = l;
    if (r < heap.length && heap[r]!.priority < heap[s]!.priority) s = r;
    if (s === i) break;
    [heap[i], heap[s]] = [heap[s]!, heap[i]!];
    i = s;
  }
  return top;
}

while (heap.length > 0 && expanded < 8_000_000) {
  const frame = pop();
  expanded++;
  if (expanded % 200_000 === 0) {
    console.log("expanded", expanded, "heap", heap.length, "bestChips", bestChips);
  }
  if (frame.runner.completed) {
    const full = [...toolsPrefix, ...frame.moves];
    fs.writeFileSync(path.join(__dirname, "level003-solution.json"), `${JSON.stringify(full)}\n`);
    console.log("SOLVED", full.length, "expanded", expanded);
    process.exit(simulateMsCc1Level(structuredClone(level), full).completed ? 0 : 1);
  }
  const chips = frame.runner.playerState.chipsRemainingOnMap;
  if (chips < bestChips) {
    bestChips = chips;
    console.log("best chips", bestChips, "depth", toolsPrefix.length + frame.moves.length, frame.runner.gx, frame.runner.gy);
  }
  if (frame.moves.length >= 100 || frame.runner.playerDied) continue;
  for (const dir of dirs) {
    const next = cloneMsCc1SimulationRunner(frame.runner);
    const before = msCc1RunnerStateKey(next);
    stepMsCc1Simulation(next, dir);
    if (next.playerDied) continue;
    const after = msCc1RunnerStateKey(next);
    if (after === before || seen.has(after)) continue;
    seen.add(after);
    push({
      moves: [...frame.moves, dir],
      runner: next,
      priority: next.playerState.chipsRemainingOnMap * 10_000 + frame.moves.length,
    });
  }
}
console.log("FAIL", expanded, bestChips);
process.exit(1);
