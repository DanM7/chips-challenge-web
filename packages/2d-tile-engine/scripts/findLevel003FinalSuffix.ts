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

const target = { gx: 12, gy: 15, chips: 1 };
const allTools = ["suction_boots", "fire_boots", "flippers", "ice_skates"];

function hasAllTools(tools: string[]): boolean {
  return allTools.every((t) => tools.includes(t));
}

// Find prefix: tools first + chip collection to target state
type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };
const q: Frame[] = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen = new Set<string>();
let prefix: Direction[] | null = null;

while (q.length > 0 && !prefix) {
  const f = q.shift()!;
  const k = msCc1RunnerStateKey(f.runner);
  if (seen.has(k)) continue;
  seen.add(k);
  if (
    f.runner.gx === target.gx &&
    f.runner.gy === target.gy &&
    f.runner.playerState.chipsRemainingOnMap === target.chips &&
    hasAllTools(f.runner.playerState.tools)
  ) {
    prefix = f.moves;
    break;
  }
  if (f.moves.length >= 50 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q.push({ moves: [...f.moves, d], runner: n });
  }
}

if (!prefix) {
  console.error("no prefix");
  process.exit(1);
}
console.log("prefix", prefix.length);

const start = createMsCc1SimulationRunner(structuredClone(level));
for (const m of prefix) stepMsCc1Simulation(start, m);
const left = [];
for (let y = 0; y < start.level.height; y++) {
  for (let x = 0; x < start.level.width; x++) {
    if (getCompositeTile(start.level, x, y) === "chip") left.push({ x, y });
  }
}
console.log("chip left", left, "pos", start.gx, start.gy);

const queue: Frame[] = [{ moves: [], runner: start }];
const seen2 = new Set<string>([msCc1RunnerStateKey(start)]);
let expanded = 0;

while (queue.length > 0 && expanded < 10_000_000) {
  const frame = queue.shift()!;
  expanded++;
  if (frame.runner.completed) {
    const full = [...prefix, ...frame.moves];
    const verify = simulateMsCc1Level(structuredClone(level), full);
    fs.writeFileSync(path.join(__dirname, "level003-solution.json"), `${JSON.stringify(full)}\n`);
    console.log("SOLVED", full.length, "suffix", frame.moves.length, "verified", verify.completed);
    process.exit(verify.completed ? 0 : 1);
  }
  if (frame.moves.length >= 150 || frame.runner.playerDied) continue;
  for (const dir of dirs) {
    const next = cloneMsCc1SimulationRunner(frame.runner);
    const before = msCc1RunnerStateKey(next);
    stepMsCc1Simulation(next, dir);
    if (next.playerDied) continue;
    const after = msCc1RunnerStateKey(next);
    if (after === before || seen2.has(after)) continue;
    seen2.add(after);
    queue.push({ moves: [...frame.moves, dir], runner: next });
  }
}
console.log("NO SUFFIX", expanded);
process.exit(1);
