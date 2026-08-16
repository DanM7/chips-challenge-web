import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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
type Act = Direction | "wait";

function toLetters(seq: Act[]): string[] {
  return seq.map((a) => (a === "wait" ? "W" : LETTER[a]));
}

function expand(notation: string): Act[] {
  const out: Act[] = [];
  for (const tok of notation.trim().split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLRW])$/);
    if (!m) throw new Error(tok);
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i++) {
      const ch = m[2]!;
      out.push(
        ch === "W"
          ? "wait"
          : ch === "U"
            ? "up"
            : ch === "D"
              ? "down"
              : ch === "L"
                ? "left"
                : "right",
      );
    }
  }
  return out;
}

function applyActs(r: MsCc1SimulationRunner, seq: Act[]): void {
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
}

/** Compact key: Chip + blocks + keys + chips left + toggle walls + traps held. */
function puzzleKey(r: MsCc1SimulationRunner): string {
  const blocks: string[] = [];
  const toggles: string[] = [];
  for (let y = 0; y < r.level.height; y++) {
    for (let x = 0; x < r.level.width; x++) {
      const t = getCompositeTile(r.level, x, y);
      if (t === "block_movable") blocks.push(`${x},${y}`);
      if (t === "block_toggle_open" || t === "block_toggle_closed") {
        toggles.push(`${x},${y}:${t[t.length - 1]}`);
      }
    }
  }
  const browns = [...r.buttonPressCtx.heldBrownButtons].sort().join(";");
  return [
    `${r.gx},${r.gy}`,
    `c${r.playerState.chipsRemainingOnMap}`,
    `k${r.playerState.keys.slice().sort().join(",")}`,
    `b${blocks.join(";")}`,
    `t${toggles.join(";")}`,
    `w${browns}`,
  ].join("|");
}

function waterCount(level: LevelData): number {
  let n = 0;
  for (let y = 20; y <= 23; y++) {
    if (getCompositeTile(level, 16, y) === "water") n++;
  }
  return n;
}

function bfs(
  start: MsCc1SimulationRunner,
  maxDepth: number,
  maxNodes: number,
  done: (r: MsCc1SimulationRunner) => boolean,
  allowWait = false,
): Act[] | null {
  const q: { seq: Act[]; runner: MsCc1SimulationRunner }[] = [
    { seq: [], runner: cloneMsCc1SimulationRunner(start) },
  ];
  const seen = new Set([puzzleKey(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (done(f.runner)) {
      console.log("bfs ok", nodes, toLetters(f.seq).join(""));
      return f.seq;
    }
    if (f.runner.playerDied || f.seq.length >= maxDepth) continue;
    const acts: Act[] = allowWait ? [...dirs, "wait"] : [...dirs];
    for (const a of acts) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied) continue;
      const key = puzzleKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("bfs fail", { nodes, maxDepth, seen: seen.size });
  return null;
}

const route: Act[] = [];
let runner = createMsCc1SimulationRunner(structuredClone(level));

function go(seq: Act[], label: string): void {
  applyActs(runner, seq);
  route.push(...seq);
  console.log(
    label,
    toLetters(seq).join(""),
    `pos=${runner.gx},${runner.gy} chips=${runner.playerState.chipsRemainingOnMap} keys=${runner.playerState.keys.join("+") || "-"} water=${waterCount(runner.level)} mb=${runner.buttonPressCtx.moveBoundary}`,
  );
  if (runner.playerDied) throw new Error(`${label}: ${runner.deathMessage}`);
}

go(expand("4R 2L 4D"), "1-yellow");
go(expand("4U 5R"), "2-blocks");

while (waterCount(runner.level) > 0) {
  const before = waterCount(runner.level);
  const seq = bfs(runner, 40, 800_000, (r) => waterCount(r.level) < before);
  if (!seq) throw new Error(`bridge from ${before}`);
  go(seq, `bridge-${before}`);
}

{
  const seq = bfs(runner, 25, 200_000, (r) =>
    r.playerState.keys.some((k) => k.includes("red")),
  );
  if (!seq) throw new Error("red");
  go(seq, "red");
}

{
  const toIce = bfs(runner, 30, 200_000, (r) => {
    const t = getCompositeTile(r.level, r.gx, r.gy);
    return t === "ice" || t.startsWith("ice");
  });
  if (!toIce) throw new Error("ice entry");
  go(toIce, "ice-entry");

  const ice = expand("R D L U L D R U L D 2R D L U L U");
  const trial = cloneMsCc1SimulationRunner(runner);
  applyActs(trial, ice);
  console.log(
    "ice trial",
    trial.gx,
    trial.gy,
    "chips",
    trial.playerState.chipsRemainingOnMap,
    "died",
    trial.playerDied,
    trial.deathMessage ?? "",
  );
  if (!trial.playerDied) go(ice, "ice");
  else {
    const seq = bfs(
      runner,
      50,
      500_000,
      (r) => r.playerState.chipsRemainingOnMap <= 7 || (r.gx >= 19 && r.gy <= 22),
    );
    if (!seq) throw new Error("ice bfs");
    go(seq, "ice-bfs");
  }
}

{
  const seq = bfs(
    runner,
    140,
    1_500_000,
    (r) => r.gx <= 14 && r.gy <= 10,
    true,
  );
  if (!seq) throw new Error("keychain");
  go(seq, "keychain");
}

{
  const seq = bfs(
    runner,
    250,
    2_500_000,
    (r) => r.playerState.chipsRemainingOnMap === 0,
    true,
  );
  if (!seq) throw new Error("chips");
  go(seq, "chips");
}

{
  const seq = bfs(runner, 80, 800_000, (r) => r.completed, true);
  if (!seq) throw new Error("exit");
  go(seq, "exit");
}

const verify = createMsCc1SimulationRunner(structuredClone(level));
applyActs(verify, route);
const rem = msSecondsRemaining(400, verify.buttonPressCtx.moveBoundary);
const letters = toLetters(route);
const moves = letters.filter((c) => c !== "W").length;
const waits = letters.filter((c) => c === "W").length;
console.log({
  completed: verify.completed,
  died: verify.playerDied,
  rem,
  exact: rem === 306,
  moves,
  waits,
  ticks: verify.buttonPressCtx.moveBoundary,
  len: letters.length,
});

if (verify.completed) {
  const entry = {
    levelId: "level-009",
    passwordMs: "KCRE",
    title: "Nuts and Bolts",
    timeLimitSeconds: 400,
    boldTimeRemaining: 306,
    minChipMoves: 94,
    moves: letters,
    source: "https://scores.bitbusters.club/levels/cc1/9/ms",
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint:
      "Yellow key → lock → hold E force → blocks to water → red ice RDLULDRULD2RDLULU → green×2 → key chain → bugs/blocks/bombs → socket → block on brown → exit",
    moveVerified: rem === 306,
    meetsBoldBudget: rem >= 306,
    moveSource: `StrategyWiki segments + compact BFS; rem ${rem} (bold 306)`,
    simulatedTicks: verify.buttonPressCtx.moveBoundary,
    simulatedSecondsRemaining: rem,
    boldGapNote:
      rem === 306 ? undefined : `Completed ${rem} vs bold 306 (gap ${rem - 306})`,
  };
  writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
  console.log("wrote", webSolPath);
}
