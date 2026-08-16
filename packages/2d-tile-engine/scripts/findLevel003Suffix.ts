/**
 * Suffix BFS from a saved prefix state (level 3 one-chip milestone).
 * Run: npx tsx scripts/findLevel003Suffix.ts
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

// Prefix from chip-first BFS milestone: 1 chip at (19,15) after 24 moves.
// Re-discover prefix by mini BFS targeting that state.
const target = { gx: 19, gy: 15, chips: 1 };

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };
const prefixQueue: Frame[] = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const prefixSeen = new Set<string>();
let prefixMoves: Direction[] | null = null;

while (prefixQueue.length > 0 && !prefixMoves) {
  const frame = prefixQueue.shift()!;
  const key = msCc1RunnerStateKey(frame.runner);
  if (prefixSeen.has(key)) continue;
  prefixSeen.add(key);
  if (
    frame.runner.gx === target.gx &&
    frame.runner.gy === target.gy &&
    frame.runner.playerState.chipsRemainingOnMap === target.chips
  ) {
    prefixMoves = frame.moves;
    break;
  }
  if (frame.moves.length >= 30 || frame.runner.playerDied) continue;
  for (const dir of dirs) {
    const next = cloneMsCc1SimulationRunner(frame.runner);
    stepMsCc1Simulation(next, dir);
    if (!next.playerDied) prefixQueue.push({ moves: [...frame.moves, dir], runner: next });
  }
}

if (!prefixMoves) {
  console.error("Could not find prefix to", target);
  process.exit(1);
}
console.log("prefix", prefixMoves.length, "moves");

const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefixMoves) stepMsCc1Simulation(start, m);

const queue: Frame[] = [{ moves: [], runner: start }];
const seen = new Set<string>([msCc1RunnerStateKey(start)]);
let expanded = 0;
const maxSuffix = 140;

while (queue.length > 0 && expanded < 5_000_000) {
  const frame = queue.shift()!;
  expanded++;
  if (frame.runner.completed) {
    const full = [...prefixMoves, ...frame.moves];
    const verify = simulateMsCc1Level(structuredClone(level), full);
    const out = path.join(__dirname, "level003-solution.json");
    fs.writeFileSync(out, `${JSON.stringify(full)}\n`);
    console.log("SOLVED", full.length, "moves, suffix", frame.moves.length, "expanded", expanded);
    console.log("verified", verify.completed);
    process.exit(verify.completed ? 0 : 1);
  }
  if (frame.moves.length >= maxSuffix || frame.runner.playerDied) continue;
  for (const dir of dirs) {
    const next = cloneMsCc1SimulationRunner(frame.runner);
    const before = msCc1RunnerStateKey(next);
    stepMsCc1Simulation(next, dir);
    if (next.playerDied) continue;
    const after = msCc1RunnerStateKey(next);
    if (after === before || seen.has(after)) continue;
    seen.add(after);
    queue.push({ moves: [...frame.moves, dir], runner: next });
  }
}

console.log("NO SUFFIX", expanded);
process.exit(1);
