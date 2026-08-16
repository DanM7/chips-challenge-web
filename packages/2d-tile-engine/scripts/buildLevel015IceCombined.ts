/**
 * Rebuild to fire, then BFS ice_skates+blue_key together, then chips/exit.
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
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";
const dirs: Direction[] = ["up", "down", "left", "right"];

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

function save(letters: string[], label: string, r: Runner) {
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters,
        label,
        rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
        ticks: r.buttonPressCtx.moveBoundary,
      },
      null,
      2,
    ),
  );
  console.log(label, {
    pos: [r.gx, r.gy],
    chips: r.playerState.chipsRemainingOnMap,
    tools: r.playerState.tools,
    keys: r.playerState.keys,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    died: r.playerDied,
    done: r.completed,
  });
}

function mazeKey(r: Runner): string {
  let blocks = "";
  for (let y = 10; y <= 16; y++)
    for (let x = 16; x <= 28; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") blocks += `${x},${y};`;
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    blocks,
    cellTile(r.level, "upper", 24, 12),
    cellTile(r.level, "upper", 24, 14),
    getCompositeTile(r.level, 16, 9),
  ].join("|");
}

function bfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
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
  console.error("  expanded", n);
  return null;
}

let letters = [
  ..."LLLLDDDLLLLLLULURRRRR",
  ..."LLLDDRRRRRUUUUUULLLLLLDLDRRRRR",
];
let r = applyLetters(letters);

const early = [
  { label: "chips11", depth: 80, nodes: 400_000, done: (x: Runner) => x.playerState.chipsRemainingOnMap <= 11 },
  { label: "chips10", depth: 80, nodes: 400_000, done: (x: Runner) => x.playerState.chipsRemainingOnMap <= 10 },
  {
    label: "chips10_blue",
    depth: 40,
    nodes: 200_000,
    done: (x: Runner) =>
      x.playerState.chipsRemainingOnMap <= 10 && x.playerState.keys.includes("key_blue"),
  },
  { label: "chips9", depth: 100, nodes: 600_000, done: (x: Runner) => x.playerState.chipsRemainingOnMap <= 9 },
  { label: "chips8", depth: 80, nodes: 400_000, done: (x: Runner) => x.playerState.chipsRemainingOnMap <= 8 },
  { label: "chips7", depth: 80, nodes: 400_000, done: (x: Runner) => x.playerState.chipsRemainingOnMap <= 7 },
  { label: "chips6", depth: 100, nodes: 600_000, done: (x: Runner) => x.playerState.chipsRemainingOnMap <= 6 },
  {
    label: "blue_safe",
    depth: 100,
    nodes: 800_000,
    done: (x: Runner) =>
      x.playerState.keys.includes("key_blue") &&
      x.playerState.tools.includes("suction_boots"),
  },
];

for (const g of early) {
  console.log("Searching", g.label);
  const seg = bfs(r, g.depth, g.nodes, g.done);
  if (!seg) {
    console.error("FAIL", g.label);
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, g.label, r);
}

if (r.gx !== 20 || r.gy !== 13) {
  const seg = bfs(r, 60, 400_000, (x) => x.gx === 20 && x.gy === 13);
  if (!seg) process.exit(1);
  letters.push(...encodeSolutionMoves(seg));
}
letters.push(..."UUURRRRRRDRDLLLLL");
r = applyLetters(letters);
save(letters, "fire", r);
if (!r.playerState.tools.includes("fire_boots") || !r.playerState.keys.includes("key_red")) {
  console.error("fire failed");
  process.exit(1);
}

// Combined: ice skates + bomb cleared + blue key
console.log("Searching ice_complete");
{
  const seg = bfs(
    r,
    100,
    1_500_000,
    (x) =>
      x.playerState.tools.includes("ice_skates") &&
      cellTile(x.level, "upper", 24, 14) !== "bomb" &&
      x.playerState.keys.includes("key_blue"),
  );
  if (!seg) {
    console.error("FAIL ice_complete");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, "ice", r);
}

for (const [label, depth, nodes, done] of [
  ["chips3", 150, 1_000_000, (x: Runner) => x.playerState.chipsRemainingOnMap <= 3],
  [
    "chips0",
    220,
    1_500_000,
    (x: Runner) =>
      x.playerState.chipsRemainingOnMap <= 0 && !x.playerState.tools.includes("ice_skates"),
  ],
  [
    "exit89",
    120,
    1_000_000,
    (x: Runner) =>
      x.completed &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  ],
] as const) {
  console.log("Searching", label);
  const seg = bfs(r, depth, nodes, done);
  if (!seg) {
    console.error("FAIL", label);
    save(letters, "fail-" + label, r);
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  save(letters, label, r);
}

const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
console.log("FINAL", {
  rem,
  ticks: r.buttonPressCtx.moveBoundary,
  exact: rem === BOLD,
  brown: getCompositeTile(r.level, 16, 9),
  trap: isTrapOpen(r.buttonPressCtx, 16, 16),
});

if (r.completed && !r.playerDied && rem >= BOLD) {
  let finalLetters = letters;
  let finalRem = rem;
  let finalTicks = r.buttonPressCtx.moveBoundary;
  if (rem > BOLD) {
    const target = (TIME_LIMIT - BOLD) * 5;
    while (finalTicks < target) {
      const i = Math.max(0, finalLetters.length - 15);
      const cand = [...finalLetters.slice(0, i), "L", "R", ...finalLetters.slice(i)];
      const t = applyLetters(cand);
      if (!t.completed || t.playerDied) break;
      const tr = msSecondsRemaining(TIME_LIMIT, t.buttonPressCtx.moveBoundary);
      if (tr < BOLD) break;
      finalLetters = cand;
      finalRem = tr;
      finalTicks = t.buttonPressCtx.moveBoundary;
      if (tr === BOLD) break;
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
  console.log("WROTE", finalRem, "exact", finalRem === BOLD, "moves", finalLetters.length);
}
