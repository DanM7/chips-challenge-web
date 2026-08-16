#!/usr/bin/env node
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
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { readLevelSolution, writeLevelSolution } from "../integration/solutionStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const webSolutionsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);
const dirs: Direction[] = ["up", "down", "left", "right"];

function loadLevel(): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, "level-011.json"), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function prefixRunner(level: LevelData, records: { tick: number; direction: number }[]) {
  const tws = replayTwsRecords(structuredClone(level), records);
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const m of tws.chipMoves) {
    if (stepMsCc1Simulation(runner, m)) break;
  }
  return { runner, prefixMoves: tws.chipMoves };
}

function bfs(start: ReturnType<typeof createMsCc1SimulationRunner>, maxDepth: number) {
  const q: { seq: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> }[] = [
    { seq: [], runner: start },
  ];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let nodes = 0;
  while (q.length) {
    const f = q.shift()!;
    nodes += 1;
    if (f.runner.completed) return { seq: f.seq, nodes };
    if (f.runner.playerDied || f.seq.length >= maxDepth) continue;
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
  return { seq: null, nodes };
}

const entry = readLevelSolution<{
  levelId: string;
  timeLimitSeconds: number;
  boldTimeRemaining: number;
  twsRecords: { tick: number; direction: number }[];
}>(11)!;
const level = loadLevel();
const { runner: start, prefixMoves } = prefixRunner(level, entry.twsRecords);
console.log("start", start.gx, start.gy, "chips", start.playerState.chipsRemainingOnMap);
const { seq, nodes } = bfs(start, 100);
console.log("bfs nodes", nodes, "suffix", seq?.length ?? null);
if (!seq) process.exit(1);

const allMoves = [...prefixMoves, ...seq];
const verify = createMsCc1SimulationRunner(structuredClone(level));
for (const m of allMoves) {
  if (stepMsCc1Simulation(verify, m)) break;
}
const rem = msSecondsRemaining(entry.timeLimitSeconds, verify.buttonPressCtx.moveBoundary);
console.log({ completed: verify.completed, rem, bold: entry.boldTimeRemaining, ticks: verify.buttonPressCtx.moveBoundary });
if (!verify.completed) process.exit(1);

const updated = {
  ...entry,
  moves: encodeSolutionMoves(allMoves),
  moveVerified: true,
  meetsBoldBudget: rem >= entry.boldTimeRemaining,
  moveSource: "CC1-ms TWS chip prefix + BFS suffix; StrategyWiki bold 211",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
};
writeLevelSolution(11, updated);
const { twsRecords, twsRecordSource, ...webEntry } = updated as Record<string, unknown> & {
  twsRecords?: unknown;
  twsRecordSource?: unknown;
};
fs.mkdirSync(webSolutionsDir, { recursive: true });
fs.writeFileSync(path.join(webSolutionsDir, "level-011.json"), `${JSON.stringify(webEntry, null, 2)}\n`);
console.log("wrote level-011");
