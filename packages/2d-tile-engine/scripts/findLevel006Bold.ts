/**
 * Level 6: StrategyWiki opener + BFS to win; optimize for bold 94.
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

function apply(start: Runner, seq: Direction[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

function bfsWin(start: Runner, maxDepth: number, maxNodes: number): Direction[] | null {
  const q: { seq: Direction[]; runner: Runner }[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let n = 0;
  let best: { seq: Direction[]; ticks: number } | null = null;
  while (q.length && n < maxNodes) {
    const f = q.shift()!;
    n++;
    if (f.runner.completed) {
      const ticks = f.runner.buttonPressCtx.moveBoundary;
      if (!best || ticks < best.ticks) best = { seq: f.seq, ticks };
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
  }
  return best?.seq ?? null;
}

const openers: Direction[][] = [
  ["left", "left", "left", "up", "up", "up", "left", "left", "left", "down"],
  ["left", "left", "left", "up", "up", "up", "left", "left", "left", "down", "down"],
];

for (const opener of openers) {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  r = apply(r, opener);
  console.log("opener", opener.map((d) => d[0]).join(""), "pos", r.gx, r.gy, "chips", r.playerState.chipsRemainingOnMap);
  if (r.playerDied) continue;
  const rest = bfsWin(r, 40, 500_000);
  if (!rest) {
    console.log("  no win from here");
    continue;
  }
  const full = [...opener, ...rest];
  const verify = apply(createMsCc1SimulationRunner(structuredClone(level)), full);
  const rem = msSecondsRemaining(100, verify.buttonPressCtx.moveBoundary);
  console.log(
    "  SOLVED moves",
    full.length,
    "ticks",
    verify.buttonPressCtx.moveBoundary,
    "rem",
    rem,
    "bold",
    rem >= 94,
  );
  console.log("  ", full.map((d) => d[0]!.toUpperCase()).join(" "));
}
