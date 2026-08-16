/**
 * Find all short paths to all four boots, then suffix-BFS each for level completion.
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
const allTools = ["suction_boots", "fire_boots", "flippers", "ice_skates"];

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

function hasAllTools(tools: string[]): boolean {
  return allTools.every((t) => tools.includes(t));
}

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };

// Phase 1: all tool routes up to depth 35
const toolRoutes: Direction[][] = [];
const q1: Frame[] = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen1 = new Set<string>();
while (q1.length > 0 && toolRoutes.length < 12) {
  const f = q1.shift()!;
  const k = msCc1RunnerStateKey(f.runner);
  if (seen1.has(k)) continue;
  seen1.add(k);
  if (hasAllTools(f.runner.playerState.tools) && f.runner.playerState.chipsRemainingOnMap === 4) {
    toolRoutes.push(f.moves);
    console.log("tool route", f.moves.length, "at", f.runner.gx, f.runner.gy);
    continue;
  }
  if (f.moves.length >= 35 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(n, d);
    if (!n.playerDied) q1.push({ moves: [...f.moves, d], runner: n });
  }
}
console.log("tool routes", toolRoutes.length);

for (const prefix of toolRoutes) {
  const start = createMsCc1SimulationRunner(structuredClone(level));
  for (const m of prefix) stepMsCc1Simulation(start, m);

  const queue: Frame[] = [{ moves: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let expanded = 0;

  while (queue.length > 0 && expanded < 500_000) {
    const frame = queue.shift()!;
    expanded++;
    if (frame.runner.completed) {
      const full = [...prefix, ...frame.moves];
      const verify = simulateMsCc1Level(structuredClone(level), full);
      if (verify.completed) {
        const out = path.join(__dirname, "level003-solution.json");
        fs.writeFileSync(out, `${JSON.stringify(full)}\n`);
        console.log("SOLVED", full.length, "prefix", prefix.length, "expanded", expanded);
        process.exit(0);
      }
    }
    if (frame.moves.length >= 130 || frame.runner.playerDied) continue;
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
  console.log("no finish from prefix len", prefix.length, "expanded", expanded);
}

console.log("FAIL all prefixes");
process.exit(1);
