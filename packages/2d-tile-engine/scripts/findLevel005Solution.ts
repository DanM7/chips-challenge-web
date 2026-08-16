/**
 * Level 5 BFS (0 chips, traps + bugs).
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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const q: { moves: Direction[]; runner: Runner }[] = [
  { moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) },
];
const seen = new Set<string>();
let n = 0;
const maxDepth = 80;
const maxNodes = 2_000_000;

while (q.length && n < maxNodes) {
  const f = q.shift()!;
  n++;
  if (f.runner.completed) {
    fs.writeFileSync(path.join(__dirname, "level005-solution.json"), `${JSON.stringify(f.moves)}\n`);
    console.log("SOLVED", f.moves.length, "expanded", n, simulateMsCc1Level(structuredClone(level), f.moves).completed);
    process.exit(0);
  }
  if (f.moves.length >= maxDepth || f.runner.playerDied) continue;
  for (const d of dirs) {
    const next = cloneMsCc1SimulationRunner(f.runner);
    const before = msCc1RunnerStateKey(next);
    stepMsCc1Simulation(next, d);
    if (next.playerDied) continue;
    const after = msCc1RunnerStateKey(next);
    if (after === before || seen.has(after)) continue;
    seen.add(after);
    q.push({ moves: [...f.moves, d], runner: next });
  }
  if (n % 200_000 === 0) console.log("expanded", n, "depth", f.moves.length);
}

console.log("NO SOLVE", n);
process.exit(1);
