/**
 * From chips0 at ice thief: slide back, get keys, block on brown, exit rem>=89.
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
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
);
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

function listKeysOnMap(r: Runner): string[] {
  const out: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const c = getCompositeTile(r.level, x, y);
      if (String(c).startsWith("key_")) out.push(`${x},${y}:${c}`);
    }
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
    getCompositeTile(r.level, 16, 9),
    cellTile(r.level, "upper", 16, 11),
    cellTile(r.level, "upper", 18, 11),
    cellTile(r.level, "upper", 16, 15),
    cellTile(r.level, "upper", 18, 15),
    isTrapOpen(r.buttonPressCtx, 16, 16) ? "1" : "0",
  ].join("|");
}

function bfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  label: string,
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
      console.log(label, "found", n, "len", f.seq.length);
      return f.seq;
    }
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > MAX_TICKS + 20
    )
      continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      if (next.buttonPressCtx.moveBoundary > MAX_TICKS + 20) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  console.error(label, "expanded", n, "seen", seen.size);
  return null;
}

let letters = saved.letters;
let r = applyLetters(letters);
console.log("start", {
  pos: [r.gx, r.gy],
  chips: r.playerState.chipsRemainingOnMap,
  tools: r.playerState.tools,
  keys: r.playerState.keys,
  ticks: r.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
  blocks: listBlocks(r),
  mapKeys: listKeysOnMap(r),
  brown: getCompositeTile(r.level, 16, 9),
  trap: isTrapOpen(r.buttonPressCtx, 16, 16),
  socket: cellTile(r.level, "upper", 16, 10),
});

const goals: { label: string; depth: number; nodes: number; done: (x: Runner) => boolean }[] = [
  {
    label: "blue_key",
    depth: 80,
    nodes: 800_000,
    done: (x) => x.playerState.keys.includes("key_blue"),
  },
  {
    label: "block_brown",
    depth: 120,
    nodes: 1_500_000,
    done: (x) => getCompositeTile(x.level, 16, 9) === "block_movable",
  },
  {
    label: "exit_ge89",
    depth: 80,
    nodes: 800_000,
    done: (x) =>
      x.completed &&
      !x.playerDied &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  },
];

for (const g of goals) {
  if (g.done(r)) {
    console.log("skip", g.label);
    continue;
  }
  console.log("Searching", g.label);
  const seg = bfs(r, g.depth, g.nodes, g.done, g.label);
  if (!seg) {
    // If blue_key fails, try block_brown/exit without key (doors may already be open enough)
    if (g.label === "blue_key") {
      console.log("no blue key reachable; continuing");
      continue;
    }
    console.error("FAIL", g.label);
    writeFileSync(
      path.join(root, ".tmp/level015-bold-letters.json"),
      JSON.stringify(
        {
          letters,
          label: "fail-" + g.label,
          rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
          ticks: r.buttonPressCtx.moveBoundary,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  console.log(g.label, {
    pos: [r.gx, r.gy],
    keys: r.playerState.keys,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    blocks: listBlocks(r),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    done: r.completed,
  });
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters,
        label: g.label,
        rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
        ticks: r.buttonPressCtx.moveBoundary,
      },
      null,
      2,
    ),
  );
}

let rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
console.log("FINAL", {
  rem,
  ticks: r.buttonPressCtx.moveBoundary,
  exact: rem === BOLD,
  completed: r.completed,
  brown: getCompositeTile(r.level, 16, 9),
  trap: isTrapOpen(r.buttonPressCtx, 16, 16),
});

if (r.completed && !r.playerDied && rem >= BOLD) {
  let finalLetters = letters;
  let finalRem = rem;
  let finalTicks = r.buttonPressCtx.moveBoundary;
  // Burn time with LR pairs if rem > 89 (need ticks in [805,809])
  if (rem > BOLD) {
    const targetLow = (TIME_LIMIT - BOLD) * 5; // 805
    let guard = 0;
    while (finalRem > BOLD && finalTicks < targetLow && guard++ < 40) {
      const i = Math.max(0, finalLetters.length - 20);
      const cand = [...finalLetters.slice(0, i), "L", "R", ...finalLetters.slice(i)];
      const t = applyLetters(cand);
      if (!t.completed || t.playerDied) {
        // try earlier insert
        const j = Math.max(0, finalLetters.length - 40);
        const cand2 = [...finalLetters.slice(0, j), "L", "R", ...finalLetters.slice(j)];
        const t2 = applyLetters(cand2);
        if (!t2.completed || t2.playerDied) break;
        const tr2 = msSecondsRemaining(TIME_LIMIT, t2.buttonPressCtx.moveBoundary);
        if (tr2 < BOLD) break;
        finalLetters = cand2;
        finalRem = tr2;
        finalTicks = t2.buttonPressCtx.moveBoundary;
      } else {
        const tr = msSecondsRemaining(TIME_LIMIT, t.buttonPressCtx.moveBoundary);
        if (tr < BOLD) break;
        finalLetters = cand;
        finalRem = tr;
        finalTicks = t.buttonPressCtx.moveBoundary;
      }
      if (finalRem === BOLD) break;
    }
  }
  writeFileSync(
    webPath,
    `${JSON.stringify(
      {
        levelId: "level-015",
        passwordMs: "COZQ",
        title: "Elementary",
        timeLimitSeconds: 250,
        boldTimeRemaining: 89,
        minChipMoves: 161,
        moves: finalLetters,
        source: "https://scores.bitbusters.club/levels/cc1/15/ms",
        walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
        boldRouteHint:
          "Red key left → flippers+blue; blue → suction+red; water+force; blue→fire+red; red→skates+blue; chips; ice thief; brown→exit; 89",
        moveVerified: true,
        meetsBoldBudget: finalRem >= BOLD,
        moveSource: `StrategyWiki Elementary bold; engine-verified ${finalRem}s left (bold 89)`,
        simulatedTicks: finalTicks,
        simulatedSecondsRemaining: finalRem,
      },
      null,
      2,
    )}\n`,
  );
  console.log("WROTE", {
    rem: finalRem,
    exact: finalRem === BOLD,
    moves: finalLetters.length,
    ticks: finalTicks,
  });
}
