/**
 * Level 15 Elementary: full StrategyWiki bold builder.
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
const outPath = path.join(root, ".tmp/level015-bold-letters.json");
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
  return `${msCc1RunnerStateKey(r)}|${r.buttonPressCtx.moveBoundary}`;
}

function segmentBfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  allowWait = false,
): { seg: Action[]; nodes: number } | null {
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
    if (done(f.runner)) return { seg: f.seq, nodes: n };
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

function status(label: string, r: Runner, extra?: object) {
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
    ...extra,
  });
}

const full: Action[] = [];
let r = createMsCc1SimulationRunner(structuredClone(level));

function append(label: string, seq: Action[]) {
  full.push(...seq);
  r = apply(createMsCc1SimulationRunner(structuredClone(level)), full);
  status(label, r, { seg: encodeSolutionMoves(seq).join(""), total: full.length });
  if (r.playerDied) {
    console.error("DIED", label);
    process.exit(1);
  }
  writeFileSync(
    outPath,
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

function bfs(
  label: string,
  depth: number,
  nodes: number,
  done: (runner: Runner) => boolean,
  allowWait = false,
) {
  console.log("Searching", label);
  const result = segmentBfs(r, depth, nodes, done, allowWait);
  if (!result) {
    console.error("FAIL", label);
    process.exit(1);
  }
  append(`${label} (${result.nodes} nodes)`, result.seg);
}

// 1-2. SW flippers+blue, NW suction+red
append("SW", parse("LLLLDDDLLLLLLULURRRRR"));
append("NW", parse("LLLDDRRRRRUUUUUULLLLLLDLDRRRRR"));

// 3. Water + force: 3 chips each → chipsRemaining <= 6, plus blue key from water
bfs(
  "water_force_6chips",
  220,
  2_000_000,
  (x) =>
    x.playerState.chipsRemainingOnMap <= 6 &&
    x.playerState.tools.includes("flippers") &&
    x.playerState.tools.includes("suction_boots"),
);

// 4. NE fire boots + bomb cleared + preferably red key
bfs(
  "fire_boots",
  50,
  600_000,
  (x) =>
    x.playerState.tools.includes("fire_boots") &&
    cellTile(x.level, "upper", 24, 12) !== "bomb",
);

// 5. SE ice skates + bomb cleared
bfs(
  "ice_skates",
  50,
  600_000,
  (x) =>
    x.playerState.tools.includes("ice_skates") &&
    cellTile(x.level, "upper", 24, 14) !== "bomb",
);

// 6. Push center block left once
bfs(
  "block_L",
  40,
  400_000,
  (x) => getCompositeTile(x.level, 17, 13) === "block_movable",
);

// 7. Fire + ice chips → 0 remaining (and ideally lost skates to thief)
bfs(
  "all_chips",
  280,
  2_500_000,
  (x) => x.playerState.chipsRemainingOnMap <= 0,
);

// 8. Exit with rem >= 89
bfs(
  "exit_bold",
  100,
  1_000_000,
  (x) =>
    x.completed &&
    msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  true,
);

const letters = encodeSolutionMoves(full);
const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
console.log("FINAL", {
  rem,
  ticks: r.buttonPressCtx.moveBoundary,
  moves: letters.length,
  waits: letters.filter((c) => c === "W").length,
  chipMoves: letters.filter((c) => c !== "W").length,
  exact: rem === BOLD,
});
writeFileSync(outPath, JSON.stringify({ letters, rem, ticks: r.buttonPressCtx.moveBoundary }, null, 2));
