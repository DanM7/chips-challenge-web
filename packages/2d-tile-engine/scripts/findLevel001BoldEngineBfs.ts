/**
 * Engine-verified shortest path for Lesson 1 from StrategyWiki opener.
 * Target: ≤89 moveBoundary ticks → 83s remaining.
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  cloneMsCc1SimulationRunner,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const DIRS: Direction[] = ["left", "right", "up", "down"];
const LETTER: Record<Direction, string> = {
  left: "L",
  right: "R",
  up: "U",
  down: "D",
};

function stateKey(r: MsCc1SimulationRunner): string {
  const keys = [...r.playerState.keys].sort().join(",");
  // Include key multiset properly
  const keyCounts = r.playerState.keys.reduce(
    (acc, k) => {
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const keySig = Object.entries(keyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join(",");
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    keySig,
    r.buttonPressCtx.moveBoundary,
    r.completed ? 1 : 0,
  ].join("|");
}

/** Fingerprint without tick — for visited set (shortest path in moves). */
function posKey(r: MsCc1SimulationRunner): string {
  const keyCounts = r.playerState.keys.reduce(
    (acc, k) => {
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const keySig = Object.entries(keyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join(",");
  // Hash level chip/key/door leftovers via remaining chips + keys + position is not enough
  // for doors opened. Use layer fingerprint of relevant cells.
  const cells: string[] = [];
  for (const [x, y] of [
    [10, 12],
    [20, 12],
    [13, 13],
    [13, 15],
    [17, 13],
    [17, 15],
    [16, 20],
    [12, 12],
    [18, 12],
    [12, 16],
    [18, 16],
    [14, 17],
    [16, 17],
    [13, 11],
    [17, 11],
    [15, 11],
    [10, 13],
    [10, 15],
    [10, 10],
    [12, 10],
    [13, 14],
    [15, 16],
    [17, 14],
    [14, 19],
    [16, 19],
    [20, 13],
    [20, 15],
    [18, 10],
  ] as Array<[number, number]>) {
    const lower = r.level.layers.lower[y * r.level.width + x];
    const upper = r.level.layers.upper[y * r.level.width + x];
    cells.push(`${x},${y}:${upper}/${lower}`);
  }
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${keySig}|${cells.join(";")}`;
}

const opener = "LLUUL";
const start = createMsCc1SimulationRunner(structuredClone(level));
const dirMap: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};
for (const ch of opener) {
  stepMsCc1Simulation(start, dirMap[ch]!);
}

type Node = { runner: MsCc1SimulationRunner; path: string };
const queue: Node[] = [{ runner: start, path: opener }];
const seen = new Set<string>([posKey(start)]);
const maxTicks = 89;
let expanded = 0;
let best: Node | null = null;

console.log("BFS start", {
  pos: [start.gx, start.gy],
  chips: start.playerState.chipsRemainingOnMap,
  keys: start.playerState.keys,
  ticks: start.buttonPressCtx.moveBoundary,
});

while (queue.length > 0) {
  const node = queue.shift()!;
  expanded += 1;
  if (expanded % 20000 === 0) {
    console.log("expanded", expanded, "q", queue.length, "best", best?.path.length);
  }

  for (const d of DIRS) {
    const nextRunner = cloneMsCc1SimulationRunner(node.runner);
    const before = { x: nextRunner.gx, y: nextRunner.gy };
    stepMsCc1Simulation(nextRunner, d);
    if (nextRunner.playerDied) continue;
    if (nextRunner.gx === before.x && nextRunner.gy === before.y && !nextRunner.completed) {
      continue;
    }
    if (nextRunner.buttonPressCtx.moveBoundary > maxTicks) continue;

    const nextPath = node.path + LETTER[d];
    if (nextRunner.completed) {
      const rem = msSecondsRemaining(100, nextRunner.buttonPressCtx.moveBoundary);
      console.log("FOUND", nextRunner.buttonPressCtx.moveBoundary, rem, nextPath.length, nextPath);
      if (!best || nextPath.length < best.path.length) {
        best = { runner: nextRunner, path: nextPath };
      }
      continue;
    }

    const key = posKey(nextRunner);
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({ runner: nextRunner, path: nextPath });
  }

  if (best && queue.length > 0) {
    // BFS by moves: first found is shortest in voluntary moves among those ≤89 ticks
    // Keep searching same length? Actually first completion in BFS is fewest moves.
    break;
  }
}

console.log({ expanded, seen: seen.size, bestLen: best?.path.length, ticks: best?.runner.buttonPressCtx.moveBoundary });

if (!best) {
  process.exit(1);
}

const rem = msSecondsRemaining(100, best.runner.buttonPressCtx.moveBoundary);
const letters = best.path.split("") as Array<"L" | "R" | "U" | "D">;
const moves = encodeSolutionMoves(letters.map((L) => dirMap[L]!));
const engineSol = path.join(root, "integration/data/cc1-ms-solutions/level-001.json");
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-001.json",
);
const existing = JSON.parse(readFileSync(engineSol, "utf8")) as Record<string, unknown>;
const out = {
  ...existing,
  moves,
  moveVerified: true,
  meetsBoldBudget: rem >= 83,
  moveSource: `engine BFS from StrategyWiki opener; ${rem}s left (bold 83)`,
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
  boldRouteHint: "2L 2U L, yellow/green keys, counterclockwise chips → 83 left",
  simulatedTicks: best.runner.buttonPressCtx.moveBoundary,
  simulatedSecondsRemaining: rem,
};
mkdirSync(path.join(root, ".tmp"), { recursive: true });
writeFileSync(path.join(root, ".tmp/level001-bold-solution.json"), JSON.stringify(out, null, 2));
if (rem >= 83) {
  writeFileSync(engineSol, JSON.stringify(out, null, 2) + "\n");
  copyFileSync(engineSol, webSol);
  console.log("Wrote bold solution");
} else {
  console.log("Best under budget but not bold?", rem);
}
