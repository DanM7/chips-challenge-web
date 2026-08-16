import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { LevelData } from "../engine/types.js";

const jobs = [
  {
    n: 3,
    bold: 89,
    limit: 100,
    hint: "Flippers → skates → fire boots → suction+chip → exit → 89",
  },
  {
    n: 4,
    bold: 116,
    limit: 150,
    hint: "West tanks, south blocks, east top then bottom chips → 116",
  },
  {
    n: 8,
    bold: 96,
    limit: 100,
    hint: "4R, U/D, east chip, east exit (odd step) → 96",
  },
  {
    n: 16,
    bold: 971,
    limit: 999,
    hint: "StrategyWiki maze path → 971 T-Chip",
    untimed: true,
  },
] as const;

for (const j of jobs) {
  const id = String(j.n).padStart(3, "0");
  const engine = `integration/data/cc1-ms-solutions/level-${id}.json`;
  const web = `../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-${id}.json`;
  const levelPath = `../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${id}.json`;
  const sol = JSON.parse(readFileSync(engine, "utf8")) as Record<string, unknown> & {
    moves?: string[];
    timeLimitSeconds?: number;
  };
  const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  const moves = decodeSolutionMoves(sol.moves ?? []);
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    if (stepMsCc1Simulation(runner, d)) break;
  }
  const scoreLimit = "untimed" in j && j.untimed ? 999 : (sol.timeLimitSeconds ?? j.limit);
  const ticks = runner.buttonPressCtx.moveBoundary;
  const rem = msSecondsRemaining(scoreLimit, ticks);
  const ok = runner.completed && rem >= j.bold;
  console.log(
    JSON.stringify({
      n: j.n,
      done: runner.completed,
      ticks,
      rem,
      bold: j.bold,
      ok,
      moves: moves.length,
    }),
  );
  if (!ok) continue;
  const out = {
    ...sol,
    boldTimeRemaining: j.bold,
    timeLimitSeconds: "untimed" in j && j.untimed ? 0 : (sol.timeLimitSeconds ?? j.limit),
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint: j.hint,
    moveVerified: true,
    meetsBoldBudget: true,
    moveSource: `StrategyWiki/BitBusters bold; engine-verified ${rem} left (bold ${j.bold})${"untimed" in j && j.untimed ? " T-Chip/999" : ""}`,
    simulatedTicks: ticks,
    simulatedSecondsRemaining: rem,
  };
  writeFileSync(engine, JSON.stringify(out, null, 2) + "\n");
  copyFileSync(engine, web);
  console.log("wrote", id);
}
