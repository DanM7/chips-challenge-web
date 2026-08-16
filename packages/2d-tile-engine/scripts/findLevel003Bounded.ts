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
const maxDepth = Number.parseInt(process.argv[2] ?? "70", 10);

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

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };
const q: Frame[] = [{ moves: [], runner: createMsCc1SimulationRunner(structuredClone(level)) }];
const seen = new Set<string>();
let expanded = 0;

while (q.length > 0 && expanded < 5_000_000) {
  const f = q.shift()!;
  expanded++;
  if (f.runner.completed) {
    const out = path.join(__dirname, "level003-solution.json");
    fs.writeFileSync(out, `${JSON.stringify(f.moves)}\n`);
    console.log("SOLVED", f.moves.length, "expanded", expanded, simulateMsCc1Level(structuredClone(level), f.moves).completed);
    process.exit(0);
  }
  if (f.moves.length >= maxDepth || f.runner.playerDied) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.runner);
    const before = msCc1RunnerStateKey(n);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const after = msCc1RunnerStateKey(n);
    if (after === before || seen.has(after)) continue;
    seen.add(after);
    q.push({ moves: [...f.moves, d], runner: n });
  }
}
console.log("NO SOLVE depth", maxDepth, "expanded", expanded);
process.exit(1);
