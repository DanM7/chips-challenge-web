/**
 * Re-BFS each TWS milestone segment to shave ticks toward bold 89.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const TIME_LIMIT = 250;
const BOLD = 89;
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    getCompositeTile(r.level, 18, 13),
    getCompositeTile(r.level, 17, 13),
    getCompositeTile(r.level, 16, 9),
  ].join("|");
}

function bfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
): Direction[] | null {
  type Frame = { seq: Direction[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set([mazeKey(start)]);
  let n = 0;
  let qi = 0;
  while (qi < q.length && n < maxNodes) {
    const f = q[qi++]!;
    n++;
    if (done(f.runner)) return f.seq;
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > MAX_TICKS
    ) {
      continue;
    }
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > MAX_TICKS) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  return null;
}

function apply(r: Runner, seq: Direction[]) {
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
}

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];

// Use TWS until all boots, then BFS chip milestones + ice thief + exit
const bootIdx = 114;
const prefix = tws.slice(0, bootIdx);
let r = createMsCc1SimulationRunner(structuredClone(level));
apply(r, prefix);
console.log("after boots", {
  pos: { x: r.gx, y: r.gy },
  tools: r.playerState.tools,
  ticks: r.buttonPressCtx.moveBoundary,
});

const full: Direction[] = [...prefix];

const goals: { label: string; depth: number; nodes: number; done: (x: Runner) => boolean }[] = [
  { label: "chips10", depth: 120, nodes: 600_000, done: (x) => x.playerState.chipsRemainingOnMap <= 10 },
  { label: "chips9", depth: 80, nodes: 400_000, done: (x) => x.playerState.chipsRemainingOnMap <= 9 },
  { label: "chips6", depth: 160, nodes: 800_000, done: (x) => x.playerState.chipsRemainingOnMap <= 6 },
  { label: "chips3", depth: 160, nodes: 800_000, done: (x) => x.playerState.chipsRemainingOnMap <= 3 },
  {
    label: "chips0_via_ice_thief",
    depth: 200,
    nodes: 1_000_000,
    done: (x) =>
      x.playerState.chipsRemainingOnMap <= 0 && !x.playerState.tools.includes("ice_skates"),
  },
  {
    label: "exit89",
    depth: 80,
    nodes: 600_000,
    done: (x) =>
      x.completed &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  },
];

for (const g of goals) {
  console.log("Searching", g.label);
  const seg = bfs(r, g.depth, g.nodes, g.done);
  if (!seg) {
    console.error("FAIL", g.label, {
      pos: { x: r.gx, y: r.gy },
      chips: r.playerState.chipsRemainingOnMap,
      tools: r.playerState.tools,
      ticks: r.buttonPressCtx.moveBoundary,
    });
    writeFileSync(
      path.join(root, ".tmp/level015-partial.json"),
      JSON.stringify({ letters: encodeSolutionMoves(full), fail: g.label }, null, 2),
    );
    process.exit(1);
  }
  full.push(...seg);
  apply(r, seg);
  console.log("OK", g.label, {
    len: seg.length,
    total: full.length,
    pos: { x: r.gx, y: r.gy },
    chips: r.playerState.chipsRemainingOnMap,
    tools: r.playerState.tools,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    done: r.completed,
  });
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters: encodeSolutionMoves(full),
        label: g.label,
        rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
        ticks: r.buttonPressCtx.moveBoundary,
      },
      null,
      2,
    ),
  );
}

console.log("FINAL", {
  rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
  ticks: r.buttonPressCtx.moveBoundary,
  moves: full.length,
  exact: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary) === BOLD,
});
