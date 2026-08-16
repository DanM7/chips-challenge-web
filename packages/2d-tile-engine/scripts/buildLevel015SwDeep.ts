/**
 * Level 15 StrategyWiki from SW+NW openings; deep BFS per chip milestone.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

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
type Action = Direction | "wait";
const dirs: Direction[] = ["up", "down", "left", "right"];

function parse(s: string): Action[] {
  return [...s].map((c) =>
    c === "U" ? "up" : c === "D" ? "down" : c === "L" ? "left" : c === "R" ? "right" : "wait",
  );
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

function mazeKey(r: Runner): string {
  // lightweight — no full digest
  let block = "";
  for (const [x, y] of [
    [18, 13],
    [17, 13],
    [16, 13],
    [16, 12],
    [16, 11],
    [16, 10],
    [16, 9],
    [6, 11],
    [6, 15],
    [26, 11],
    [26, 15],
  ] as const) {
    if (getCompositeTile(r.level, x, y) === "block_movable") block += `${x},${y};`;
  }
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    block,
    cellTile(r.level, "upper", 8, 14), // sw bomb
    cellTile(r.level, "upper", 8, 12),
    cellTile(r.level, "upper", 24, 12),
    cellTile(r.level, "upper", 24, 14),
    cellTile(r.level, "upper", 16, 11),
    cellTile(r.level, "upper", 16, 15),
  ].join("|");
}

function bfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  allowWait = false,
): Action[] | null {
  type Frame = { seq: Action[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set([mazeKey(start)]);
  let n = 0;
  let qi = 0;
  while (qi < q.length && n < maxNodes) {
    const f = q[qi++]!;
    n++;
    if (done(f.runner)) {
      console.log("  found", n, "len", f.seq.length);
      return f.seq;
    }
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > MAX_TICKS
    ) {
      continue;
    }
    const actions: Action[] = allowWait ? [...dirs, "wait"] : dirs;
    for (const a of actions) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > MAX_TICKS) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("  expanded", n);
  return null;
}

const full: Action[] = [];
let r = createMsCc1SimulationRunner(structuredClone(level));

function append(label: string, seq: Action[]) {
  full.push(...seq);
  r = apply(createMsCc1SimulationRunner(structuredClone(level)), full);
  console.log(label, {
    pos: { x: r.gx, y: r.gy },
    chips: r.playerState.chipsRemainingOnMap,
    tools: r.playerState.tools,
    keys: r.playerState.keys,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    died: r.playerDied,
    done: r.completed,
  });
  if (r.playerDied) {
    console.error("DIED");
    process.exit(1);
  }
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters: encodeSolutionMoves(full),
        label,
        ticks: r.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
      },
      null,
      2,
    ),
  );
}

function goal(
  label: string,
  depth: number,
  nodes: number,
  done: (x: Runner) => boolean,
  allowWait = false,
) {
  console.log("Searching", label);
  const seg = bfs(r, depth, nodes, done, allowWait);
  if (!seg) {
    console.error("FAIL", label);
    process.exit(1);
  }
  append(label, seg);
}

append("SW", parse("LLLLDDDLLLLLLULURRRRR"));
append("NW", parse("LLLDDRRRRRUUUUUULLLLLLDLDRRRRR"));

goal("chips11", 80, 400_000, (x) => x.playerState.chipsRemainingOnMap <= 11);
goal("chips10", 80, 400_000, (x) => x.playerState.chipsRemainingOnMap <= 10);
goal(
  "chips10_blue",
  40,
  200_000,
  (x) => x.playerState.chipsRemainingOnMap <= 10 && x.playerState.keys.includes("key_blue"),
);
goal("chips9", 100, 600_000, (x) => x.playerState.chipsRemainingOnMap <= 9);
goal("chips8", 80, 400_000, (x) => x.playerState.chipsRemainingOnMap <= 8);
goal("chips7", 80, 400_000, (x) => x.playerState.chipsRemainingOnMap <= 7);
goal("chips6", 100, 600_000, (x) => x.playerState.chipsRemainingOnMap <= 6);
goal(
  "fire_boots",
  60,
  400_000,
  (x) =>
    x.playerState.tools.includes("fire_boots") &&
    cellTile(x.level, "upper", 24, 12) !== "bomb",
);
goal(
  "ice_skates",
  60,
  400_000,
  (x) =>
    x.playerState.tools.includes("ice_skates") &&
    cellTile(x.level, "upper", 24, 14) !== "bomb",
);
goal("chips5", 80, 400_000, (x) => x.playerState.chipsRemainingOnMap <= 5);
goal("chips4", 80, 400_000, (x) => x.playerState.chipsRemainingOnMap <= 4);
goal("chips3", 80, 400_000, (x) => x.playerState.chipsRemainingOnMap <= 3);
goal(
  "chips0_no_skates",
  200,
  1_000_000,
  (x) =>
    x.playerState.chipsRemainingOnMap <= 0 && !x.playerState.tools.includes("ice_skates"),
);
goal(
  "exit89",
  80,
  600_000,
  (x) =>
    x.completed &&
    msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  true,
);

const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
console.log("FINAL", {
  rem,
  ticks: r.buttonPressCtx.moveBoundary,
  moves: full.length,
  exact: rem === BOLD,
});
