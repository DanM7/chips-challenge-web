/**
 * Level 15 Elementary bold builder — StrategyWiki order.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
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

const LETTER: Record<string, Action> = {
  U: "up",
  D: "down",
  L: "left",
  R: "right",
  W: "wait",
};

function parse(s: string): Action[] {
  return [...s.replace(/\s+/g, "")].map((c) => LETTER[c]!);
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

function stateKey(r: Runner): string {
  return `${msCc1RunnerStateKey(r)}|${r.buttonPressCtx.moveBoundary}|h:${[...r.buttonPressCtx.heldBrownButtons].join(",")}`;
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

function status(label: string, r: Runner) {
  console.log(label, {
    pos: { x: r.gx, y: r.gy },
    chips: r.playerState.chipsRemainingOnMap,
    tools: [...r.playerState.tools],
    keys: [...r.playerState.keys],
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    died: r.playerDied,
    death: r.deathMessage,
    completed: r.completed,
    block18: getCompositeTile(r.level, 18, 13),
    block17: getCompositeTile(r.level, 17, 13),
    brown: getCompositeTile(r.level, 16, 9),
  });
}

// SW: red key, flippers, blue key (bomb cleared)
const sw = parse("LLLLDDDLLLLLLULURRRRR");

// From (10,14): to NW — R to center corridor, U through blue door, around top to push block D then RR into bomb
const nwVariants = [
  // (10,14) -> (12,14) -> up to door -> around
  "RRUULULLLLLDRDRRRR",
  "RRUUULLLLLDRDRRRR",
  "RRUULULLLLLDDRRRR",
  "R RU U L U LLLLL D R D R R R R".replace(/ /g, ""),
  // via (12,11) door then left on row 10
  "RRUUULLLLLLDDRRRR",
  "RRUULU LLLLL DDRRRR".replace(/ /g, ""),
  "RRUU L ULLLLLD R RRRR".replace(/ /g, ""),
  // get to (6,10), push D, then L D R R R to bomb and key
  "RRUUULLLLLLDDRDRRR",
  "RRUUULLLLLLD LDRRRR".replace(/ /g, ""),
  "RRUUULLLLLLDLURRRR",
  "RRUUULLLLLLDRRRRR",
];

console.log("NW variants from after SW:");
const afterSw = apply(createMsCc1SimulationRunner(structuredClone(level)), sw);
status("after SW", afterSw);

for (const v of nwVariants) {
  const seq = parse(v);
  const test = apply(afterSw, seq);
  const ok =
    !test.playerDied &&
    test.playerState.tools.includes("suction_boots") &&
    test.playerState.keys.includes("key_red") &&
    cellTile(test.level, "upper", 8, 12) !== "bomb";
  console.log((ok ? "OK " : "   ") + v, {
    pos: { x: test.gx, y: test.gy },
    tools: test.playerState.tools,
    keys: test.playerState.keys,
    bomb: cellTile(test.level, "upper", 8, 12),
    died: test.playerDied,
    death: test.deathMessage,
    ticks: test.buttonPressCtx.moveBoundary,
  });
}

// Also BFS from after SW to suction+red+bomb clear
console.log("\nBFS NW...");
const nwBfs = segmentBfs(
  afterSw,
  40,
  500_000,
  (r) =>
    r.playerState.tools.includes("suction_boots") &&
    r.playerState.keys.includes("key_red") &&
    cellTile(r.level, "upper", 8, 12) !== "bomb",
);
if (nwBfs) {
  console.log("BFS NW", encodeSolutionMoves(nwBfs).join(""), "len", nwBfs.length);
  status("after NW bfs", apply(afterSw, nwBfs));
}
