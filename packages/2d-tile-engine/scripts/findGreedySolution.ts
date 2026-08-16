import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { COLLECTIBLE_CHIP_TILE_ID } from "../tile-engine/tiles.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  runnerToResult,
  simulateMsCc1AutoplayLevel,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { readLevelSolution, writeLevelSolution } from "../integration/solutionStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelId = process.argv[2] ?? "level-001";
const maxDepth = Number.parseInt(process.argv[3] ?? "120", 10);

const levelPath = path.join(
  __dirname,
  `../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/${levelId}.json`,
);
const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
normalizeLevelLayers(level);

const dirs: Direction[] = ["up", "down", "left", "right"];
const WAIT = "__wait__" as const;
type Action = Direction | typeof WAIT;
const hasMonsters = (level.monsters?.length ?? 0) > 0;
const actions: Action[] = hasMonsters ? [...dirs, WAIT] : [...dirs];

function scoreRunner(runner: ReturnType<typeof createMsCc1SimulationRunner>): number {
  const chips = runner.playerState.chipsRemainingOnMap;
  if (chips === 0) {
    return 1000 - runner.chipMoves;
  }
  let nearest = 999;
  for (let y = 0; y < runner.level.height; y += 1) {
    for (let x = 0; x < runner.level.width; x += 1) {
      if (getCompositeTile(runner.level, x, y) === COLLECTIBLE_CHIP_TILE_ID) {
        const d = Math.abs(x - runner.gx) + Math.abs(y - runner.gy);
        if (d < nearest) nearest = d;
      }
    }
  }
  return (100 - chips) * 50 - nearest * 2 - runner.chipMoves;
}

type Frame = { moves: Action[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };

const start = createMsCc1SimulationRunner(level);
const queue: Frame[] = [{ moves: [], runner: start }];
const seen = new Set<string>([msCc1RunnerStateKey(start)]);
let best: Direction[] | null = null;

function applyAction(runner: ReturnType<typeof createMsCc1SimulationRunner>, action: Action): boolean {
  if (action === WAIT) {
    return stepMsCc1Wait(runner);
  }
  return stepMsCc1Simulation(runner, action);
}

while (queue.length > 0) {
  queue.sort((a, b) => scoreRunner(b.runner) - scoreRunner(a.runner));
  const frame = queue.shift()!;
  if (frame.runner.completed) {
    best = frame.moves.filter((m): m is Direction => m !== WAIT);
    break;
  }
  if (frame.runner.playerDied || frame.moves.length >= maxDepth) {
    continue;
  }
  for (const action of actions) {
    const nextRunner = cloneMsCc1SimulationRunner(frame.runner);
    const beforeKey = msCc1RunnerStateKey(nextRunner);
    const ended = applyAction(nextRunner, action);
    if (nextRunner.playerDied) {
      continue;
    }
    const afterKey = msCc1RunnerStateKey(nextRunner);
    if (afterKey === beforeKey) {
      continue;
    }
    if (seen.has(afterKey)) {
      continue;
    }
    seen.add(afterKey);
    const nextMoves = [...frame.moves, action];
    if (nextRunner.completed) {
      best = nextMoves.filter((m): m is Direction => m !== WAIT);
      break;
    }
    if (!ended) {
      queue.push({ moves: nextMoves, runner: nextRunner });
    }
  }
  if (best) break;
}

if (!best) {
  console.error(`No greedy solution within depth ${maxDepth} for ${levelId}`);
  process.exit(1);
}

const verify = simulateMsCc1AutoplayLevel(structuredClone(level), best!);

console.log(JSON.stringify({ levelId, moves: best, ...verify }, null, 2));

const solutionsPath = path.join(__dirname, "../integration/data/cc1-ms-solutions");
const levelNum = Number.parseInt(levelId.replace(/\D/g, ""), 10);
const existing = readLevelSolution(levelNum);
if (existing && verify.completed) {
  writeLevelSolution(levelNum, {
    ...existing,
    moves: encodeSolutionMoves(best),
    moveVerified: true,
    meetsBoldBudget: false,
    moveSource:
      "engine greedy search (sim-verified); TWS reference in twsMoves (does not complete in sim)",
  });
}
