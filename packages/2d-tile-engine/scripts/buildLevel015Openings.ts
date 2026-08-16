/**
 * Level 15: StrategyWiki bold — manual corner openings + maze BFS.
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
import { encodeSolutionMoves, decodeSolutionMoves } from "../engine/solutionMoves.js";
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
const dirs: Direction[] = ["up", "down", "left", "right"];
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";

const LETTER: Record<string, Direction | "wait"> = {
  U: "up",
  D: "down",
  L: "left",
  R: "right",
  W: "wait",
};

function parse(s: string): Action[] {
  return s
    .replace(/\s+/g, "")
    .split("")
    .map((c) => LETTER[c]!);
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

function status(label: string, r: Runner, extra?: object) {
  console.log(label, {
    pos: { x: r.gx, y: r.gy },
    chips: r.playerState.chipsRemainingOnMap,
    tools: r.playerState.tools,
    keys: r.playerState.keys,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    died: r.playerDied,
    death: r.deathMessage,
    completed: r.completed,
    ...extra,
  });
}

function noBomb(r: Runner, x: number, y: number) {
  return cellTile(r.level, "upper", x, y) !== "bomb";
}

function stateKey(r: Runner): string {
  return `${msCc1RunnerStateKey(r)}|${r.buttonPressCtx.moveBoundary}`;
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  allowWait = false,
): Action[] | null {
  type Frame = { seq: Action[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([stateKey(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
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
      const key = stateKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("expanded", n);
  return null;
}

// --- Manual StrategyWiki opening ---
// Red key left, SW corner: push block U then around to R into bomb; flippers + blue key
// Path: LLLL (red key) DD (door) D LLLLLL U (push block U, get flippers)
// Then L U R (to left of block) R (push to 7,14) R (into bomb) R R (blue key)
const openingSw = parse("LLLLDDDLLLLLLULURRRRR");
// Wait - need to verify. After LLLL at (12,13), DDD to (12,16), LLLLLL to (6,16), U pushes block.

let r = createMsCc1SimulationRunner(structuredClone(level));
let full: Action[] = [];

function run(label: string, seq: Action[]) {
  full.push(...seq);
  r = apply(createMsCc1SimulationRunner(structuredClone(level)), full);
  status(label, r, {
    bombs: {
      sw: cellTile(r.level, "upper", 8, 14),
      nw: cellTile(r.level, "upper", 8, 12),
      ne: cellTile(r.level, "upper", 24, 12),
      se: cellTile(r.level, "upper", 24, 14),
    },
    seq: encodeSolutionMoves(seq).join(""),
  });
  if (r.playerDied) {
    console.error("died at", label);
    process.exit(1);
  }
}

// Try several SW opening variants
const swVariants = [
  "LLLLDDDLLLLLLULURRRRR", // push U, around left, push RR into bomb, get key
  "LLLLDDDLLLLLLULURRRR", 
  "LLLLDDDLLLLLLU LU R R R R R".replace(/ /g, ""),
  "LLLL D D D LLLLLL U L U R R R R".replace(/ /g, ""),
  // alternate: approach block from right via row16
  "LLLLDDDLLLLLLURULURRRR",
  // from door go down-left-up differently  
  "LLLLDDLDDLLLLLLULURRRRR",
];

console.log("Trying SW openings...");
for (const v of swVariants) {
  const seq = parse(v);
  const test = apply(createMsCc1SimulationRunner(structuredClone(level)), seq);
  console.log(v, {
    pos: { x: test.gx, y: test.gy },
    tools: test.playerState.tools,
    keys: test.playerState.keys,
    bomb: cellTile(test.level, "upper", 8, 14),
    died: test.playerDied,
    death: test.deathMessage,
    ticks: test.buttonPressCtx.moveBoundary,
  });
}
