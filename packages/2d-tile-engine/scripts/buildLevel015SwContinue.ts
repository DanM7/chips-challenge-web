/**
 * Continue from SW deep chips6 checkpoint — grab key then fire/ice/exit.
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
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
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

const saved = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[]; label: string };

function mazeKey(r: Runner): string {
  let block = "";
  for (const [x, y] of [
    [18, 13],
    [17, 13],
    [16, 13],
    [16, 9],
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
    cellTile(r.level, "upper", 24, 12),
    cellTile(r.level, "upper", 24, 14),
    cellTile(r.level, "upper", 16, 11),
    cellTile(r.level, "upper", 16, 15),
  ].join("|");
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
    )
      continue;
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

const full: Action[] = decodeSolutionMoves(saved.letters) as Action[];
let r = apply(createMsCc1SimulationRunner(structuredClone(level)), full);
console.log("resume", saved.label, {
  pos: { x: r.gx, y: r.gy },
  chips: r.playerState.chipsRemainingOnMap,
  keys: r.playerState.keys,
  tools: r.playerState.tools,
  ticks: r.buttonPressCtx.moveBoundary,
});

function append(label: string, seq: Action[]) {
  full.push(...seq);
  r = apply(createMsCc1SimulationRunner(structuredClone(level)), full);
  console.log(label, {
    pos: { x: r.gx, y: r.gy },
    chips: r.playerState.chipsRemainingOnMap,
    keys: r.playerState.keys,
    tools: r.playerState.tools,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    died: r.playerDied,
    done: r.completed,
  });
  if (r.playerDied) process.exit(1);
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

function goal(label: string, depth: number, nodes: number, done: (x: Runner) => boolean, allowWait = false) {
  console.log("Searching", label);
  const seg = bfs(r, depth, nodes, done, allowWait);
  if (!seg) {
    console.error("FAIL", label);
    process.exit(1);
  }
  append(label, seg);
}

// Need blue key for fire boots corner
goal(
  "blue_key",
  80,
  500_000,
  (x) => x.playerState.keys.includes("key_blue") && x.playerState.chipsRemainingOnMap <= 6,
);
goal(
  "fire_boots",
  80,
  500_000,
  (x) =>
    x.playerState.tools.includes("fire_boots") &&
    cellTile(x.level, "upper", 24, 12) !== "bomb",
);
goal(
  "ice_skates",
  80,
  500_000,
  (x) =>
    x.playerState.tools.includes("ice_skates") &&
    cellTile(x.level, "upper", 24, 14) !== "bomb",
);
goal("chips3", 120, 800_000, (x) => x.playerState.chipsRemainingOnMap <= 3);
goal(
  "chips0_ice_thief",
  200,
  1_200_000,
  (x) =>
    x.playerState.chipsRemainingOnMap <= 0 && !x.playerState.tools.includes("ice_skates"),
);
goal(
  "exit89",
  100,
  800_000,
  (x) =>
    x.completed &&
    msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  true,
);

const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
console.log("FINAL", {
  rem,
  ticks: r.buttonPressCtx.moveBoundary,
  exact: rem === BOLD,
  moves: full.length,
});
