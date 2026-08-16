import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves, decodeSolutionMoves } from "../engine/solutionMoves.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const engineSolDir = path.join(root, "integration/data/cc1-ms-solutions");
const webSolDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const WALKTHROUGH =
  "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20";

function loadLevel(n: number): LevelData {
  const level = JSON.parse(
    readFileSync(path.join(levelsDir, `level-${String(n).padStart(3, "0")}.json`), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function expandRoute(route: string): Direction[] {
  const dirs: Direction[] = [];
  const re = /(\d+)?([UDLR])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(route.replace(/\s/g, ""))) !== null) {
    const count = m[1] ? Number.parseInt(m[1], 10) : 1;
    const map: Record<string, Direction> = {
      U: "up",
      D: "down",
      L: "left",
      R: "right",
    };
    for (let i = 0; i < count; i += 1) {
      dirs.push(map[m[2]!]!);
    }
  }
  return dirs;
}

function simAutoplay(level: LevelData, moves: Direction[], limit: number) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (let i = 0; i < moves.length; i += 1) {
    const d = moves[i]!;
    stepMsCc1Simulation(runner, d);
    if (runner.playerDied) {
      return {
        completed: false,
        died: true,
        death: runner.deathMessage,
        pos: `${runner.gx},${runner.gy}`,
        tile: getCompositeTile(runner.level, runner.gx, runner.gy),
        step: i + 1,
        dir: d,
        ticks: runner.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(limit, runner.buttonPressCtx.moveBoundary),
        chips: runner.playerState.chipsRemainingOnMap,
      };
    }
    if (runner.completed) {
      break;
    }
  }
  const ticks = runner.buttonPressCtx.moveBoundary;
  return {
    completed: runner.completed,
    died: runner.playerDied,
    pos: `${runner.gx},${runner.gy}`,
    ticks,
    chipMoves: runner.chipMoves,
    rem: msSecondsRemaining(limit, ticks),
    chips: runner.playerState.chipsRemainingOnMap,
    moves: encodeSolutionMoves(moves.slice(0, runner.chipMoves)),
  };
}

function simTwsDetailed(
  level: LevelData,
  records: { tick: number; direction: number }[],
  limit: number,
) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let prevTick = 0;
  let chipStep = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap; i += 1) {
      if (stepMsCc1Wait(runner)) break;
    }
    if (stepMsCc1Wait(runner)) break;
    chipStep += 1;
    stepMsCc1Simulation(runner, dir);
    if (runner.playerDied || runner.completed) {
      return {
        completed: runner.completed,
        died: runner.playerDied,
        death: runner.deathMessage,
        pos: `${runner.gx},${runner.gy}`,
        tile: getCompositeTile(runner.level, runner.gx, runner.gy),
        chipStep,
        dir,
        ticks: runner.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(limit, runner.buttonPressCtx.moveBoundary),
        chips: runner.playerState.chipsRemainingOnMap,
        moves: encodeSolutionMoves(
          replayTwsRecords(structuredClone(level), records).chipMoves,
        ),
      };
    }
    prevTick = rec.tick;
  }
  const ticks = runner.buttonPressCtx.moveBoundary;
  return {
    completed: runner.completed,
    died: runner.playerDied,
    pos: `${runner.gx},${runner.gy}`,
    chipStep,
    ticks,
    rem: msSecondsRemaining(limit, ticks),
    chips: runner.playerState.chipsRemainingOnMap,
    moves: encodeSolutionMoves(
      replayTwsRecords(structuredClone(level), records).chipMoves,
    ),
  };
}

function promoteSolution(
  n: number,
  moves: string[],
  meta: {
    timeLimitSeconds: number;
    boldTimeRemaining: number;
    title: string;
    passwordMs: string;
    moveSource: string;
    remaining: number;
    ticks: number;
    twsRecords?: unknown[];
    rngNote?: string;
  },
) {
  const id = `level-${String(n).padStart(3, "0")}`;
  const existing = readLevelSolution<Record<string, unknown>>(n) ?? {};
  const meets = meta.remaining >= meta.boldTimeRemaining;
  const out = {
    ...existing,
    levelId: id,
    passwordMs: meta.passwordMs,
    title: meta.title,
    timeLimitSeconds: meta.timeLimitSeconds,
    boldTimeRemaining: meta.boldTimeRemaining,
    moves,
    walkthroughUrl: WALKTHROUGH,
    moveVerified: true,
    meetsBoldBudget: meets,
    moveSource: meta.moveSource,
    simulatedTicks: meta.ticks,
    simulatedSecondsRemaining: meta.remaining,
    ...(meta.rngNote ? { rngNote: meta.rngNote } : {}),
  };
  writeFileSync(path.join(engineSolDir, `${id}.json`), JSON.stringify(out, null, 2) + "\n");
  copyFileSync(
    path.join(engineSolDir, `${id}.json`),
    path.join(webSolDir, `${id}.json`),
  );
  console.log(`PROMOTED ${id}: rem=${meta.remaining} bold=${meta.boldTimeRemaining} meets=${meets}`);
}

// --- Level 17: StrategyWiki + RNG trials ---
console.log("\n=== Level 17 Nice Day ===");
{
  const n = 17;
  const level = loadLevel(n);
  const sol = readLevelSolution<{
    timeLimitSeconds: number;
    boldTimeRemaining: number;
    title: string;
    passwordMs: string;
    twsRecords: { tick: number; direction: number }[];
  }>(n)!;
  console.log("TWS fail:", simTwsDetailed(level, sol.twsRecords, sol.timeLimitSeconds));

  const route17 =
    "5L 2U R 2D" + // first eye
    "R R R R R R R R R R R R R R R R R R R R R R R R R R R R" + // east to other eye - placeholder
    "";
  void route17;

  const sw17a = expandRoute("5L2UR2D"); // first eye only test
  console.log("SW first eye:", simAutoplay(level, sw17a, sol.timeLimitSeconds));

  // Full StrategyWiki skeleton without exact east count — try TWS encoded if we fix RNG
  let best17: ReturnType<typeof simAutoplay> | null = null;
  for (let trial = 0; trial < 200; trial += 1) {
    const r = simTwsDetailed(level, sol.twsRecords, sol.timeLimitSeconds);
    if (r.completed && (!best17 || (r.rem ?? 0) > (best17.rem ?? 0))) {
      best17 = r;
      if ((r.rem ?? 0) >= sol.boldTimeRemaining) break;
    }
  }
  console.log("TWS RNG trials best:", best17);
}

// --- Level 18 ---
console.log("\n=== Level 18 Castle Moat ===");
{
  const n = 18;
  const level = loadLevel(n);
  const sol = readLevelSolution<{
    timeLimitSeconds: number;
    boldTimeRemaining: number;
    title: string;
    passwordMs: string;
    twsRecords: { tick: number; direction: number }[];
  }>(n)!;
  const tws = simTwsDetailed(level, sol.twsRecords, sol.timeLimitSeconds);
  console.log("TWS:", tws);
  if (tws.moves?.length) {
    const replay = simAutoplay(level, decodeSolutionMoves(tws.moves), sol.timeLimitSeconds);
    console.log("TWS as autoplay:", replay);
  }
}

// --- Level 19 ---
console.log("\n=== Level 19 Digger ===");
{
  const n = 19;
  const level = loadLevel(n);
  const sol = readLevelSolution<{
    timeLimitSeconds: number;
    boldTimeRemaining: number;
    title: string;
    passwordMs: string;
    twsRecords: { tick: number; direction: number }[];
  }>(n)!;
  console.log("TWS fail:", simTwsDetailed(level, sol.twsRecords, sol.timeLimitSeconds));
}

// --- Level 20 ---
console.log("\n=== Level 20 Tossed Salad ===");
{
  const n = 20;
  const level = loadLevel(n);
  const sol = readLevelSolution<{
    timeLimitSeconds: number;
    boldTimeRemaining: number;
    title: string;
    passwordMs: string;
    twsRecords: { tick: number; direction: number }[];
  }>(n)!;
  console.log("TWS fail:", simTwsDetailed(level, sol.twsRecords, sol.timeLimitSeconds));
}
