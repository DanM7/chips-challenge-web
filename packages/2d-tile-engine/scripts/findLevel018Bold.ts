/**
 * BFS for Castle Moat (level 18) — no monsters; block/water state in levelDigest.
 */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(root, "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json"),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const DIRS: Direction[] = ["up", "down", "left", "right"];
const BOLD_TICKS = 600 - 553; // 47 seconds → need mb <= 47*5 = 235? Actually remaining 553 → elapsed 47s → mb/5>=47 → mb>=235
// msSecondsRemaining(600, mb) >= 553  → floor(mb/5) <= 47 → mb <= 47*5+4 = 239

function applyMove(runner: MsCc1SimulationRunner, d: Direction): MsCc1SimulationRunner {
  const r = cloneMsCc1SimulationRunner(runner);
  stepMsCc1Simulation(r, d);
  return r;
}

const start = createMsCc1SimulationRunner(structuredClone(level));
type QItem = { r: MsCc1SimulationRunner; path: Direction[] };
const queue: QItem[] = [{ r: start, path: [] }];
const seen = new Set<string>();
seen.add(msCc1RunnerStateKey(start));

let best: { path: Direction[]; mb: number; rem: number } | null = null;
let expanded = 0;
const MAX = 800_000;

while (queue.length > 0 && expanded < MAX) {
  const { r, path } = queue.shift()!;
  expanded += 1;
  if (r.completed) {
    const mb = r.buttonPressCtx.moveBoundary;
    const rem = msSecondsRemaining(600, mb);
    if (!best || rem > best.rem || (rem === best.rem && path.length < best.path.length)) {
      best = { path, mb, rem };
    }
    if (rem >= 553) {
      console.log("Found bold completion", { moves: path.length, mb, rem });
      break;
    }
    continue;
  }
  if (r.playerDied || path.length > 280) {
    continue;
  }
  for (const d of DIRS) {
    const nr = applyMove(r, d);
    if (nr.playerDied) continue;
    const key = msCc1RunnerStateKey(nr);
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({ r: nr, path: [...path, d] });
  }
}

console.log({ expanded, seen: seen.size, best: best ? { len: best.path.length, mb: best.mb, rem: best.rem, meets: best.rem >= 553 } : null });

if (best?.rem !== undefined && best.rem >= 553) {
  const moves = encodeSolutionMoves(best.path);
  const engineSol = path.join(root, "integration/data/cc1-ms-solutions/level-018.json");
  const webSol = path.join(
    root,
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-018.json",
  );
  const existing = JSON.parse(readFileSync(engineSol, "utf8")) as Record<string, unknown>;
  const out = {
    ...existing,
    moves,
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    moveVerified: true,
    meetsBoldBudget: true,
    moveSource: `Engine BFS Castle Moat; ${best.rem}s remaining (bold 553)`,
    simulatedTicks: best.mb,
    simulatedSecondsRemaining: best.rem,
  };
  writeFileSync(engineSol, JSON.stringify(out, null, 2) + "\n");
  copyFileSync(engineSol, webSol);
}
