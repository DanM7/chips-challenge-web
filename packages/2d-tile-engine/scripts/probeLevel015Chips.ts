/**
 * Probe ice state + incremental chip BFS with richer keys.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
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

const saved = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[] };

function applyLetters(letters: string[]): Runner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (r.playerDied || r.completed) break;
  }
  return r;
}

function listBlocks(r: Runner): string[] {
  const out: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") out.push(`${x},${y}`);
  return out;
}

function listChips(r: Runner): string[] {
  const out: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "computer_chip") out.push(`${x},${y}`);
  return out;
}

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    listBlocks(r).join(";"),
    cellTile(r.level, "upper", 24, 12),
    cellTile(r.level, "upper", 24, 14),
    getCompositeTile(r.level, 16, 9),
    // door samples
    cellTile(r.level, "upper", 12, 11),
    cellTile(r.level, "upper", 14, 11),
    cellTile(r.level, "upper", 16, 11),
    cellTile(r.level, "upper", 18, 11),
    cellTile(r.level, "upper", 20, 11),
    cellTile(r.level, "upper", 12, 15),
    cellTile(r.level, "upper", 14, 15),
    cellTile(r.level, "upper", 16, 15),
    cellTile(r.level, "upper", 18, 15),
    cellTile(r.level, "upper", 20, 15),
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
  let bestChips = start.playerState.chipsRemainingOnMap;
  let bestPos = [start.gx, start.gy];
  while (qi < q.length && n < maxNodes) {
    const f = q[qi++]!;
    n++;
    if (f.runner.playerState.chipsRemainingOnMap < bestChips) {
      bestChips = f.runner.playerState.chipsRemainingOnMap;
      bestPos = [f.runner.gx, f.runner.gy];
      console.log("  best chips", bestChips, "at", bestPos, "n", n, "len", f.seq.length);
    }
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
    const acts: Action[] = allowWait ? [...dirs, "wait"] : dirs;
    for (const d of acts) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      if (d === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, d);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > MAX_TICKS) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  console.error("  expanded", n, "seen", seen.size, "bestChips", bestChips, "at", bestPos);
  return null;
}

// Prefer letters labeled ice from progress file if still at ice state; else rebuild from ice label letters
let letters = saved.letters;
let r = applyLetters(letters);
console.log("start", {
  pos: [r.gx, r.gy],
  chips: r.playerState.chipsRemainingOnMap,
  tools: r.playerState.tools,
  keys: r.playerState.keys,
  ticks: r.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
  bombs: [cellTile(r.level, "upper", 24, 12), cellTile(r.level, "upper", 24, 14)],
  blocks: listBlocks(r),
  chipsPos: listChips(r),
  doorsBlue: [12, 14, 16, 18, 20].map((x) => `${x}:` + cellTile(r.level, "upper", x, 11)),
  doorsRed: [12, 14, 16, 18, 20].map((x) => `${x}:` + cellTile(r.level, "upper", x, 15)),
});

// Try one chip at a time
for (const target of [5, 4, 3, 2, 1, 0]) {
  if (r.playerState.chipsRemainingOnMap <= target) continue;
  console.log("Searching chips", target);
  const needThief =
    target === 0
      ? (x: Runner) =>
          x.playerState.chipsRemainingOnMap <= 0 &&
          (!x.playerState.tools.includes("ice_skates") ||
            !x.playerState.tools.includes("fire_boots"))
      : (x: Runner) => x.playerState.chipsRemainingOnMap <= target;
  const seg = bfs(r, target >= 3 ? 120 : 180, 2_000_000, needThief, false);
  if (!seg) {
    console.error("FAIL chips", target);
    // try with wait for stuck force floors
    const seg2 = bfs(r, 80, 500_000, needThief, true);
    if (!seg2) {
      writeFileSync(
        path.join(root, ".tmp/level015-bold-letters.json"),
        JSON.stringify(
          {
            letters,
            label: "fail-chips" + target,
            rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
            ticks: r.buttonPressCtx.moveBoundary,
          },
          null,
          2,
        ),
      );
      process.exit(1);
    }
    letters.push(...encodeSolutionMoves(seg2));
  } else {
    letters.push(...encodeSolutionMoves(seg));
  }
  r = applyLetters(letters);
  console.log("chips" + target, {
    pos: [r.gx, r.gy],
    chips: r.playerState.chipsRemainingOnMap,
    tools: r.playerState.tools,
    keys: r.playerState.keys,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    blocks: listBlocks(r),
  });
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters,
        label: "chips" + target,
        rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
        ticks: r.buttonPressCtx.moveBoundary,
      },
      null,
      2,
    ),
  );
}

console.log("DONE chips0");
