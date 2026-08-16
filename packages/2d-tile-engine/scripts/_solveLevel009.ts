import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const levelPath = path.join(
  root,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
);
const webSolPath = path.join(
  root,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-009.json",
);

const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
normalizeLevelLayers(level);

const dirs: Direction[] = ["up", "down", "left", "right"];
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

function expand(notation: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  for (const tok of notation.trim().split(/\s+/)) {
    if (!tok) continue;
    const m = tok.match(/^(\d+)?([UDLR])$/);
    if (!m) throw new Error(`bad token ${tok}`);
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i++) out.push(map[m[2]!]!);
  }
  return out;
}

function apply(runner: MsCc1SimulationRunner, seq: Direction[]): void {
  for (const d of seq) {
    stepMsCc1Simulation(runner, d);
    if (runner.completed || runner.playerDied) break;
  }
}

function applyLetters(runner: MsCc1SimulationRunner, letters: string[]): void {
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(runner);
    else {
      const d =
        ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right";
      stepMsCc1Simulation(runner, d as Direction);
    }
    if (runner.completed || runner.playerDied) break;
  }
}

function status(label: string, r: MsCc1SimulationRunner): void {
  console.log(
    label,
    `pos=${r.gx},${r.gy}`,
    `tile=${getCompositeTile(r.level, r.gx, r.gy)}`,
    `force=${getForceFloorTileAt(r.level, r.gx, r.gy) ?? "-"}`,
    `chips=${r.playerState.chipsRemainingOnMap}`,
    `keys=${r.playerState.keys.join(",") || "-"}`,
    `died=${r.playerDied}`,
    r.deathMessage ?? "",
    `done=${r.completed}`,
    `mb=${r.buttonPressCtx.moveBoundary}`,
  );
}

/** BFS with optional waits-only-when-stuck (no auto waits). */
function segmentBfs(
  start: MsCc1SimulationRunner,
  maxDepth: number,
  maxNodes: number,
  done: (r: MsCc1SimulationRunner) => boolean,
  allowWait = false,
): Direction[] | ("wait" | Direction)[] | null {
  type Act = Direction | "wait";
  const q: { seq: Act[]; runner: MsCc1SimulationRunner }[] = [
    { seq: [], runner: start },
  ];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (done(f.runner)) return f.seq;
    if (f.runner.playerDied || f.seq.length >= maxDepth) continue;
    const acts: Act[] = allowWait ? [...dirs, "wait"] : [...dirs];
    for (const a of acts) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("segment fail nodes", nodes);
  return null;
}

function toLetters(seq: (Direction | "wait")[]): string[] {
  return seq.map((a) => (a === "wait" ? "W" : LETTER[a]));
}

const route: string[] = [];
let runner = createMsCc1SimulationRunner(structuredClone(level));

function appendDirs(seq: Direction[], label: string): void {
  apply(runner, seq);
  route.push(...seq.map((d) => LETTER[d]));
  status(label, runner);
  if (runner.playerDied) throw new Error(`died at ${label}`);
}

function appendActs(seq: (Direction | "wait")[], label: string): void {
  for (const a of seq) {
    if (a === "wait") {
      stepMsCc1Wait(runner);
      route.push("W");
    } else {
      stepMsCc1Simulation(runner, a);
      route.push(LETTER[a]);
    }
    if (runner.completed || runner.playerDied) break;
  }
  status(label, runner);
  if (runner.playerDied) throw new Error(`died at ${label}`);
}

// --- Phase 1: yellow key (GameFAQs: chip then key, or bold RRDDDD + get chip later)
// Prefer GameFAQs: RRRR to chip, then to yellow key
{
  const seq =
    segmentBfs(
      runner,
      30,
      200_000,
      (r) =>
        r.playerState.keys.some((k) => k.includes("yellow")) &&
        r.playerState.chipsRemainingOnMap <= 8,
    ) ??
    segmentBfs(
      runner,
      20,
      100_000,
      (r) => r.playerState.keys.some((k) => k.includes("yellow")),
    );
  if (!seq) throw new Error("no yellow key");
  appendActs(seq as (Direction | "wait")[], "yellow+chip");
}

// --- Phase 2: through yellow lock, then north to force stairs, hold R to blocks
{
  const seq = segmentBfs(
    runner,
    60,
    600_000,
    (r) => {
      // In block room near water / red key approach — have used yellow key and be near blocks
      const nearBlock =
        Math.abs(r.gx - 14) + Math.abs(r.gy - 26) <= 4 ||
        Math.abs(r.gx - 15) + Math.abs(r.gy - 25) <= 4;
      return (
        !r.playerState.keys.some((k) => k.includes("yellow")) && nearBlock
      );
    },
  );
  if (!seq) throw new Error("no force hold to blocks");
  appendActs(seq as (Direction | "wait")[], "to-blocks");
}

// --- Phase 3: blocks to water + red key
{
  const seq = segmentBfs(
    runner,
    100,
    1_200_000,
    (r) => r.playerState.keys.some((k) => k.includes("red")),
  );
  if (!seq) throw new Error("no red key");
  appendActs(seq as (Direction | "wait")[], "red-key");
}

// --- Phase 4: ice rink known path after red lock
{
  // First reach red lock / ice entrance
  const toIce = segmentBfs(
    runner,
    40,
    400_000,
    (r) => {
      const t = getCompositeTile(r.level, r.gx, r.gy);
      return t === "ice" || t.startsWith("ice");
    },
  );
  if (!toIce) throw new Error("no ice entry");
  appendActs(toIce as (Direction | "wait")[], "ice-entry");

  // StrategyWiki / GameFAQs ice: RDLULDRULD 2R DLULU
  const ice = expand("R D L U L D R U L D R R D L U L U");
  appendDirs(ice, "ice-path");
}

// --- Phase 5: green button twice with force boost, blue key chain, to bugs area
{
  const seq = segmentBfs(
    runner,
    150,
    1_500_000,
    (r) => r.gx <= 14 && r.gy <= 10 && r.playerState.chipsRemainingOnMap <= 7,
    true,
  );
  if (!seq) throw new Error("no key-chain / bugs");
  appendActs(seq as (Direction | "wait")[], "to-bugs");
}

// --- Phase 6: all chips + socket
{
  const seq = segmentBfs(
    runner,
    250,
    2_500_000,
    (r) => r.playerState.chipsRemainingOnMap === 0,
    true,
  );
  if (!seq) throw new Error("no chips clear");
  appendActs(seq as (Direction | "wait")[], "chips-clear");
}

// --- Phase 7: socket + final brown button block + exit
{
  const seq = segmentBfs(
    runner,
    80,
    800_000,
    (r) => r.completed,
    true,
  );
  if (!seq) throw new Error("no exit");
  appendActs(seq as (Direction | "wait")[], "exit");
}

const verify = createMsCc1SimulationRunner(structuredClone(level));
applyLetters(verify, route);
const rem = msSecondsRemaining(400, verify.buttonPressCtx.moveBoundary);
const moves = route.filter((c) => c !== "W").length;
const waits = route.filter((c) => c === "W").length;
console.log({
  completed: verify.completed,
  died: verify.playerDied,
  rem,
  bold: 306,
  exact: rem === 306,
  moves,
  waits,
  ticks: verify.buttonPressCtx.moveBoundary,
  routeLen: route.length,
});

if (verify.completed) {
  const existing = JSON.parse(readFileSync(webSolPath, "utf8")) as Record<
    string,
    unknown
  >;
  const entry = {
    levelId: "level-009",
    passwordMs: "KCRE",
    title: "Nuts and Bolts",
    timeLimitSeconds: 400,
    boldTimeRemaining: 306,
    minChipMoves: existing.minChipMoves ?? 94,
    moves: route,
    source: "https://scores.bitbusters.club/levels/cc1/9/ms",
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint:
      "Yellow key → lock → hold E force → blocks to water → red ice RDLULDRULD2RDLULU → green×2 boost → key chain → bugs/blocks/bombs → socket → block on brown → exit; 306 left",
    moveVerified: rem === 306,
    meetsBoldBudget: rem >= 306,
    moveSource: `StrategyWiki/GameFAQs segments + BFS; engine rem ${rem} (bold 306)`,
    simulatedTicks: verify.buttonPressCtx.moveBoundary,
    simulatedSecondsRemaining: rem,
  };
  // Only write if completed; parent asked write ONLY level-009.json
  writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
  console.log("wrote", webSolPath);
}
