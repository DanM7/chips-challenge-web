/**
 * Shortest chip-move route for a CC1 level in our engine.
 * Uses BFS over chip inputs with one idle monster tick before each move after the first
 * (matches web auto-play timing).
 *
 * Run: npx tsx scripts/findLevelSolution.ts <levelNumber>
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  simulateMsCc1AutoplayLevel,
  simulateMsCc1Level,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs: Direction[] = ["up", "down", "left", "right"];

const levelNum = Number.parseInt(process.argv[2] ?? "1", 10);
if (!Number.isFinite(levelNum) || levelNum < 1) {
  console.error("Usage: npx tsx scripts/findLevelSolution.ts <levelNumber>");
  process.exit(1);
}

const levelPath = path.join(
  __dirname,
  `../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(levelNum).padStart(3, "0")}.json`,
);

const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
normalizeLevelLayers(level);

const chipCells: { x: number; y: number }[] = [];
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    if (getCompositeTile(level, x, y) === "chip") {
      chipCells.push({ x, y });
    }
  }
}

const useAutoplayIdle = process.argv.includes("--autoplay-idle");
const hasMonsters = (level.monsters?.length ?? 0) > 0;

function applyAutoplayChipMove(
  runner: ReturnType<typeof createMsCc1SimulationRunner>,
  direction: Direction,
  isFirst: boolean,
): void {
  if (!isFirst && hasMonsters && useAutoplayIdle) {
    stepMsCc1Wait(runner);
  }
  stepMsCc1Simulation(runner, direction);
}

type Frame = { moves: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> };

const start = createMsCc1SimulationRunner(structuredClone(level));
const maxChipMoves = Math.max(120, chipCells.length * 30);
const maxNodes = 3_000_000;

const queue: Frame[] = [{ moves: [], runner: start }];
const seen = new Set<string>([msCc1RunnerStateKey(start)]);
let expanded = 0;
let bestChips = start.playerState.chipsRemainingOnMap;

console.log(
  `BFS level ${levelNum}: ${chipCells.length} chips, max ${maxChipMoves} chip moves${useAutoplayIdle ? ", autoplay idle ticks" : ""}`,
);

while (queue.length > 0 && expanded < maxNodes) {
  const frame = queue.shift()!;
  expanded++;

  if (frame.runner.completed) {
    const outPath = path.join(__dirname, `level${String(levelNum).padStart(3, "0")}-solution.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(frame.moves)}\n`);
    const verify = simulateMsCc1Level(structuredClone(level), frame.moves);
    const autoplayVerify = simulateMsCc1AutoplayLevel(structuredClone(level), frame.moves);
    console.log("SOLVED shortest", frame.moves.length, "chip moves, expanded", expanded);
    console.log("verified", verify.completed, "autoplay", autoplayVerify.completed);
    console.log("wrote", outPath);
    process.exit(verify.completed || autoplayVerify.completed ? 0 : 1);
  }

  const chips = frame.runner.playerState.chipsRemainingOnMap;
  if (chips < bestChips) {
    bestChips = chips;
    console.log(
      "best chips",
      bestChips,
      "depth",
      frame.moves.length,
      "pos",
      frame.runner.gx,
      frame.runner.gy,
    );
  }

  if (frame.moves.length >= maxChipMoves || frame.runner.playerDied) {
    continue;
  }

  for (const dir of dirs) {
    const next = cloneMsCc1SimulationRunner(frame.runner);
    const beforeKey = msCc1RunnerStateKey(next);
    applyAutoplayChipMove(next, dir, frame.moves.length === 0);
    if (next.playerDied) continue;
    const afterKey = msCc1RunnerStateKey(next);
    if (afterKey === beforeKey || seen.has(afterKey)) continue;
    seen.add(afterKey);
    queue.push({ moves: [...frame.moves, dir], runner: next });
  }
}

console.log("NO SOLVE", "expanded", expanded, "bestChips", bestChips, "queue", queue.length);
process.exit(1);
