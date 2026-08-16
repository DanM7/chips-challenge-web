/**
 * Level 7: BFS from start for shortest win (teleport/thief route).
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
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs: Direction[] = ["up", "down", "left", "right"];

const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-007.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function apply(start: Runner, seq: Direction[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

const q: { seq: Direction[]; runner: Runner }[] = [
  { seq: [], runner: createMsCc1SimulationRunner(structuredClone(level)) },
];
const seen = new Set<string>();
let n = 0;
let best: { seq: Direction[]; ticks: number; rem: number } | null = null;
const maxDepth = 80;
const maxNodes = 3_000_000;

while (q.length && n < maxNodes) {
  const f = q.shift()!;
  n++;
  if (f.runner.completed) {
    const ticks = f.runner.buttonPressCtx.moveBoundary;
    const rem = msSecondsRemaining(150, ticks);
    if (!best || rem > best.rem || (rem === best.rem && ticks < best.ticks)) {
      best = { seq: f.seq, ticks, rem };
      console.log("win", f.seq.length, "ticks", ticks, "rem", rem);
    }
    continue;
  }
  if (f.seq.length >= maxDepth || f.runner.playerDied) continue;
  for (const d of dirs) {
    const next = cloneMsCc1SimulationRunner(f.runner);
    const before = msCc1RunnerStateKey(next);
    stepMsCc1Simulation(next, d);
    if (next.playerDied) continue;
    const after = msCc1RunnerStateKey(next);
    if (after === before || seen.has(after)) continue;
    seen.add(after);
    q.push({ seq: [...f.seq, d], runner: next });
  }
  if (n % 500_000 === 0) console.log("expanded", n, "depth", f.seq.length, "best", best?.rem);
}

if (best) {
  console.log("BEST", best.seq.length, "ticks", best.ticks, "rem", best.rem);
  console.log(best.seq.map((d) => d[0]!.toUpperCase()).join(" "));
  fs.writeFileSync(path.join(__dirname, "level007-bold.json"), JSON.stringify(best, null, 2));
} else {
  console.log("NO SOLVE", n);
}
