/**
 * Level 15 Elementary: StrategyWiki bold route via segmented BFS.
 * Target rem === 89 (ticks 805..809).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";

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
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4; // 809
const dirs: Direction[] = ["up", "down", "left", "right"];
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";

function stateKey(r: Runner): string {
  return `${msCc1RunnerStateKey(r)}|mb:${r.buttonPressCtx.moveBoundary}|h:${[
    ...r.buttonPressCtx.heldBrownButtons,
  ].join(",")}`;
}

function apply(start: Runner, seq: Action[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  opts: { allowWait?: boolean; maxTicks?: number } = {},
): Action[] | null {
  const maxTicks = opts.maxTicks ?? MAX_TICKS;
  type Frame = { seq: Action[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([stateKey(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
    // Prefer fewer chips remaining, then fewer ticks, then shorter seq
    q.sort(
      (a, b) =>
        a.runner.playerState.chipsRemainingOnMap -
          b.runner.playerState.chipsRemainingOnMap ||
        a.runner.buttonPressCtx.moveBoundary -
          b.runner.buttonPressCtx.moveBoundary ||
        a.seq.length - b.seq.length,
    );
    const f = q.shift()!;
    n++;
    if (done(f.runner)) return f.seq;
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > maxTicks
    ) {
      continue;
    }
    const actions: Action[] = opts.allowWait ? [...dirs, "wait"] : dirs;
    for (const a of actions) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied) continue;
      if (next.buttonPressCtx.moveBoundary > maxTicks) continue;
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("expanded", n, "no solution");
  return null;
}

function hasTool(r: Runner, tool: string) {
  return r.playerState.tools.includes(tool);
}
function hasKey(r: Runner, key: string) {
  return r.playerState.keys.includes(key);
}
function at(r: Runner, x: number, y: number) {
  return r.gx === x && r.gy === y;
}
function noBlock(r: Runner, x: number, y: number) {
  return getCompositeTile(r.level, x, y) !== "block_movable";
}
function chipsAtMost(r: Runner, n: number) {
  return r.playerState.chipsRemainingOnMap <= n;
}

const goals: {
  label: string;
  depth: number;
  nodes: number;
  allowWait?: boolean;
  done: (r: Runner) => boolean;
}[] = [
  // StrategyWiki: red key left
  {
    label: "red_key_left",
    depth: 8,
    nodes: 50_000,
    done: (r) => hasKey(r, "key_red") && r.gx <= 13,
  },
  // flippers + blue from SW corner
  {
    label: "flippers",
    depth: 40,
    nodes: 400_000,
    done: (r) => hasTool(r, "flippers"),
  },
  {
    label: "blue_after_flippers",
    depth: 20,
    nodes: 200_000,
    done: (r) => hasTool(r, "flippers") && hasKey(r, "key_blue"),
  },
  // suction + red from NW
  {
    label: "suction",
    depth: 50,
    nodes: 500_000,
    done: (r) => hasTool(r, "suction_boots"),
  },
  {
    label: "red_after_suction",
    depth: 20,
    nodes: 200_000,
    done: (r) => hasTool(r, "suction_boots") && hasKey(r, "key_red"),
  },
  // water section: collect chips; after water+force expect chips <= 9 (3 chips from water? 12-3=9) then force takes 3 more -> 6
  // StrategyWiki: swim right to 2 chips + blue, SW circle, force NE, SW chip => 3 water/force chips? 
  // Actually each element area has 3 chips. Water then force = 6 chips collected, 6 remain.
  {
    label: "after_water_force_chips",
    depth: 200,
    nodes: 1_200_000,
    done: (r) =>
      chipsAtMost(r, 6) &&
      hasTool(r, "flippers") &&
      hasTool(r, "suction_boots"),
  },
  // fire boots + red (NE corner)
  {
    label: "fire_boots",
    depth: 40,
    nodes: 400_000,
    done: (r) => hasTool(r, "fire_boots"),
  },
  // ice skates + blue (SE corner)
  {
    label: "ice_skates",
    depth: 40,
    nodes: 400_000,
    done: (r) => hasTool(r, "ice_skates"),
  },
  // block pushed left from (18,13)
  {
    label: "block_left",
    depth: 30,
    nodes: 300_000,
    done: (r) => noBlock(r, 18, 13) && getCompositeTile(r.level, 17, 13) === "block_movable",
  },
  // fire then ice: all chips collected
  {
    label: "all_chips",
    depth: 250,
    nodes: 1_500_000,
    done: (r) => chipsAtMost(r, 0),
  },
  // block on brown button, socket open path, exit
  {
    label: "exit_bold",
    depth: 80,
    nodes: 800_000,
    allowWait: true,
    done: (r) =>
      r.completed &&
      msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary) >= BOLD,
  },
];

let r = createMsCc1SimulationRunner(structuredClone(level));
const full: Action[] = [];
const progressPath = path.join(root, ".tmp/level015-sw-progress.json");

for (const g of goals) {
  if (g.done(r)) {
    console.log("SKIP", g.label, {
      pos: { x: r.gx, y: r.gy },
      chips: r.playerState.chipsRemainingOnMap,
      tools: r.playerState.tools,
      keys: r.playerState.keys,
      ticks: r.buttonPressCtx.moveBoundary,
    });
    continue;
  }
  console.log("Searching", g.label, "from", {
    pos: { x: r.gx, y: r.gy },
    chips: r.playerState.chipsRemainingOnMap,
    tools: r.playerState.tools,
    keys: r.playerState.keys,
    ticks: r.buttonPressCtx.moveBoundary,
  });
  const seg = segmentBfs(r, g.depth, g.nodes, g.done, { allowWait: g.allowWait });
  if (!seg) {
    console.error("FAIL", g.label);
    writeFileSync(
      progressPath,
      JSON.stringify(
        {
          full: encodeSolutionMoves(full),
          failedAt: g.label,
          pos: { x: r.gx, y: r.gy },
          chips: r.playerState.chipsRemainingOnMap,
          tools: r.playerState.tools,
          keys: r.playerState.keys,
          ticks: r.buttonPressCtx.moveBoundary,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  full.push(...seg);
  r = apply(r, seg);
  const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
  console.log("OK", g.label, {
    segLen: seg.length,
    total: full.length,
    pos: { x: r.gx, y: r.gy },
    chips: r.playerState.chipsRemainingOnMap,
    tools: r.playerState.tools,
    keys: r.playerState.keys,
    ticks: r.buttonPressCtx.moveBoundary,
    rem,
    completed: r.completed,
  });
  writeFileSync(
    progressPath,
    JSON.stringify({ full: encodeSolutionMoves(full), label: g.label }, null, 2),
  );
}

const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
const letters = encodeSolutionMoves(full);
console.log("FINAL", {
  completed: r.completed,
  rem,
  ticks: r.buttonPressCtx.moveBoundary,
  moves: letters.length,
  waits: letters.filter((c) => c === "W").length,
  chipMoves: letters.filter((c) => c !== "W").length,
  meets: rem >= BOLD,
  exact: rem === BOLD,
});
writeFileSync(
  path.join(root, ".tmp/level015-sw-moves.json"),
  JSON.stringify(letters, null, 2),
);
