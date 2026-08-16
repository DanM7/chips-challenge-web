/**
 * Level 5: continue BFS from partial TWS chip prefix.
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
import { replayTwsRecords } from "../engine/twsReplay.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";

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

const sol = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../integration/data/cc1-ms-solutions/level-005.json"), "utf8"),
);

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
  let best: { seq: Direction[]; rem: number; ticks: number } | null = null;
  while (q.length && n < maxNodes) {
    const f = q.shift()!;
    n++;
    if (f.runner.completed) {
      const ticks = f.runner.buttonPressCtx.moveBoundary;
      const rem = msSecondsRemaining(100, ticks);
      if (!best || rem > best.rem || (rem === best.rem && ticks < best.ticks)) {
        best = { seq: f.seq, rem, ticks };
        console.log("win", f.seq.length, "ticks", ticks, "rem", rem);
        if (rem >= 85) return f.seq;
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
  }
  if (best) return best.seq;
  console.error("expanded", n);
  return null;
}

// Partial prefixes to try
const twsPartial = replayTwsRecords(structuredClone(level), sol.twsRecords.slice(0, 40)).chipMoves;
const prefixes: { label: string; moves: Direction[] }[] = [
  { label: "tws40", moves: twsPartial },
  { label: "tws35", moves: replayTwsRecords(structuredClone(level), sol.twsRecords.slice(0, 35)).chipMoves },
];

for (const p of prefixes) {
  const start = apply(createMsCc1SimulationRunner(structuredClone(level)), p.moves);
  console.log(p.label, "end", start.gx, start.gy, "keys", start.playerState.keys, "trap1", isTrapOpen(start.buttonPressCtx, 18, 7));
  const rest = bfsWin(start, 50, 1_000_000);
  if (rest) {
    const full = [...p.moves, ...rest];
    const verify = apply(createMsCc1SimulationRunner(structuredClone(level)), full);
    const rem = msSecondsRemaining(100, verify.buttonPressCtx.moveBoundary);
    console.log("SOLVED", full.length, "rem", rem);
    console.log(full.map((d) => d[0]!.toUpperCase()).join(" "));
    fs.writeFileSync(path.join(__dirname, "level005-solution.json"), JSON.stringify(full) + "\n");
    break;
  }
}
