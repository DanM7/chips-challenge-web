/**
 * Level 6: depth-limited BFS for minimum ticks win.
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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-006.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Node = { seq: Direction[]; runner: Runner; ticks: number };

const start = createMsCc1SimulationRunner(structuredClone(level));
const q: Node[] = [{ seq: [], runner: start, ticks: 0 }];
const seen = new Map<string, number>([[msCc1RunnerStateKey(start), 0]]);
let n = 0;
let best: Node | null = null;
const maxDepth = 45;
const maxNodes = 800_000;

while (q.length && n < maxNodes) {
  const f = q.shift()!;
  n++;
  if (f.runner.completed) {
    if (!best || f.ticks < best.ticks || (f.ticks === best.ticks && f.seq.length < best.seq.length)) {
      best = f;
      const rem = msSecondsRemaining(100, f.ticks);
      console.log("win", f.seq.length, "ticks", f.ticks, "rem", rem);
      if (rem >= 94) break;
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
    const ticks = next.buttonPressCtx.moveBoundary;
    if (after === before) continue;
    const prev = seen.get(after);
    if (prev !== undefined && prev <= ticks) continue;
    seen.set(after, ticks);
    q.push({ seq: [...f.seq, d], runner: next, ticks });
  }
  if (n % 100_000 === 0) console.log("expanded", n, "best", best?.ticks);
}

if (best) {
  const rem = msSecondsRemaining(100, best.ticks);
  console.log("BEST", best.seq.length, "ticks", best.ticks, "rem", rem);
  console.log(best.seq.map((d) => d[0]!.toUpperCase()).join(" "));
  fs.writeFileSync(path.join(__dirname, "level006-bold.json"), JSON.stringify({ seq: best.seq, ticks: best.ticks, rem }, null, 2));
} else {
  console.log("NO SOLVE", n);
}
