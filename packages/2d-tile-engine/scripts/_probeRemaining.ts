/** Probe Trinity override + TWS/current routes for levels 9, 11, 12, 15. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webLevels = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);

function loadLevel(n: number): LevelData {
  const id = String(n).padStart(3, "0");
  const level = JSON.parse(readFileSync(path.join(webLevels, `level-${id}.json`), "utf8")) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function replayTwsToRunner(
  level: LevelData,
  records: { tick: number; direction: number }[],
) {
  const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let prevTick = 0;
  let chipMoves = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap; i += 1) {
      stepMsCc1Wait(runner);
      if (runner.completed || runner.playerDied) return { runner, chipMoves };
    }
    stepMsCc1Wait(runner);
    if (runner.completed || runner.playerDied) return { runner, chipMoves };
    stepMsCc1Simulation(runner, dir);
    chipMoves += 1;
    prevTick = rec.tick;
    if (runner.completed || runner.playerDied) return { runner, chipMoves };
  }
  return { runner, chipMoves };
}

function summarize(n: number, label: string, r: ReturnType<typeof createMsCc1SimulationRunner>, limit: number) {
  const keys = r.playerState.keys.join("+") || "-";
  const tools = r.playerState.tools.join("+") || "-";
  console.log(`L${n} ${label}`, {
    pos: `${r.gx},${r.gy}`,
    chips: r.playerState.chipsRemainingOnMap,
    keys,
    tools,
    completed: r.completed,
    died: r.playerDied,
    death: r.deathMessage,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(limit, r.buttonPressCtx.moveBoundary),
  });
}

// --- Trinity override ---
{
  const level = loadLevel(11);
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of ["down", "left", "left", "left", "down"] as Direction[]) {
    stepMsCc1Simulation(r, d);
  }
  const force = getForceFloorTileAt(r.level, 11, 19);
  const before = `${r.gx},${r.gy}`;
  stepMsCc1Simulation(r, "up");
  console.log("Trinity D3LD then U", {
    before,
    after: `${r.gx},${r.gy}`,
    forceAt1119: force,
    died: r.playerDied,
  });
}

const twsLevels: Array<{ n: number; limit: number }> = [
  { n: 9, limit: 400 },
  { n: 11, limit: 300 },
  { n: 12, limit: 400 },
  { n: 15, limit: 250 },
];

for (const { n, limit } of twsLevels) {
  const level = loadLevel(n);
  const entry = readLevelSolution<{
    twsRecords?: { tick: number; direction: number }[];
    moves?: string[] | null;
  }>(n);
  if (entry?.twsRecords?.length) {
    const { runner, chipMoves } = replayTwsToRunner(level, entry.twsRecords);
    summarize(n, `TWS (${chipMoves} chip moves)`, runner, limit);
  }
  if (entry?.moves?.length) {
    const r = createMsCc1SimulationRunner(structuredClone(level));
    for (const a of decodeSolutionMoves(entry.moves)) {
      if (a === "wait") stepMsCc1Wait(r);
      else stepMsCc1Simulation(r, a);
      if (r.completed || r.playerDied) break;
    }
    summarize(n, "engine-moves", r, limit);
  }
  try {
    const web = JSON.parse(
      readFileSync(path.join(webSol, `level-${String(n).padStart(3, "0")}.json`), "utf8"),
    ) as { moves?: string[] | null };
    if (web.moves?.length) {
      const r = createMsCc1SimulationRunner(structuredClone(level));
      for (const a of decodeSolutionMoves(web.moves)) {
        if (a === "wait") stepMsCc1Wait(r);
        else stepMsCc1Simulation(r, a);
        if (r.completed || r.playerDied) break;
      }
      summarize(n, "web-moves", r, limit);
    }
  } catch {
    /* ignore */
  }
}

// Level 15 TWS-prefix 793 + hold-brown exit
{
  const level = loadLevel(15);
  const entry = readLevelSolution<{ moves: string[] }>(15)!;
  const tws = decodeSolutionMoves(entry.moves) as Direction[];
  // The exit88 used encodeSolutionMoves of slice then string split - do it properly:
  const exit: Direction[] = [
    "down",
    "right",
    "right",
    "up",
    "up",
    "up",
    "down",
    "down",
    "down",
    "down",
    "down",
    "down",
    "down",
    "down",
  ];
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of [...tws.slice(0, 793), ...exit]) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
  summarize(15, "tws793+hold-brown", r, 250);
  console.log("15 trap/block peek", {
    block: (() => {
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++)
          if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
      return "gone";
    })(),
  });
}
