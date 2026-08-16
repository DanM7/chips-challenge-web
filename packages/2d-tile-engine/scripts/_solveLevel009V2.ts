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
      out.push(
        m[2] === "W"
          ? "wait"
          : m[2] === "U"
            ? "up"
            : m[2] === "D"
              ? "down"
              : m[2] === "L"
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
  const seen = new Set([msCc1RunnerStateKey(start)]);
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
  console.error("fail", { nodes, maxDepth, allowWait });
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
    runner.playerDied ? runner.deathMessage : "",
  );
  if (runner.playerDied) throw new Error(label);
}

// Known good opener from prior run
go(expand("4R 2L 4D"), "1-yellow"); // RRRRLLDDDD
go(expand("4U 5R"), "2-blocks"); // UUUURRRRR

// Fill each water cell greedily
while (waterCount(runner.level) > 0) {
  const before = waterCount(runner.level);
  const seq = bfs(
    runner,
    35,
    500_000,
    (r) => waterCount(r.level) < before,
  );
  if (!seq) throw new Error(`cannot reduce water from ${before}`);
  go(seq, `bridge-${before}`);
}

// Red key
{
  const seq = bfs(
    runner,
    20,
    100_000,
    (r) => r.playerState.keys.some((k) => k.includes("red")),
  );
  if (!seq) throw new Error("no red");
  go(seq, "red");
}

// Through red lock onto ice, then known ice path
{
  const toIce = bfs(runner, 30, 200_000, (r) => {
    const t = getCompositeTile(r.level, r.gx, r.gy);
    return t === "ice" || t.startsWith("ice");
  });
  if (!toIce) throw new Error("no ice");
  go(toIce, "ice-entry");
  // After first ice step the SW path may need re-sync — try full path from red lock
}

// Prefer: from just after red key, path RDLULDRULD 2R DLULU
// Reset ice: find if we're on red lock cell or adjacent
console.log("before ice path pos", runner.gx, runner.gy, getCompositeTile(runner.level, runner.gx, runner.gy));

// Try known path; if death, BFS to chip on ice / next section
{
  const ice = expand("R D L U L D R U L D 2R D L U L U");
  const trial = cloneMsCc1SimulationRunner(runner);
  applyActs(trial, ice);
  console.log(
    "ice trial",
    `pos=${trial.gx},${trial.gy} chips=${trial.playerState.chipsRemainingOnMap} died=${trial.playerDied}`,
    trial.deathMessage ?? "",
  );
  if (!trial.playerDied && trial.playerState.chipsRemainingOnMap <= 7) {
    go(ice, "ice");
  } else {
    // BFS toward green button area / lower chips
    const seq = bfs(
      runner,
      40,
      400_000,
      (r) => r.playerState.chipsRemainingOnMap <= 7 || r.gx >= 20,
    );
    if (!seq) throw new Error("ice fail");
    go(seq, "ice-bfs");
  }
}

// Green button twice + blue key chain → bugs room (chip count drops / position NW)
{
  const seq = bfs(
    runner,
    120,
    1_000_000,
    (r) => r.gx <= 13 && r.gy <= 12 && r.playerState.keys.length >= 1,
    true,
  );
  if (!seq) {
    // fallback: any progress into left area
    const seq2 = bfs(
      runner,
      120,
      1_000_000,
      (r) => r.gx <= 14 && r.gy <= 10,
      true,
    );
    if (!seq2) throw new Error("keychain fail");
    go(seq2, "keychain");
  } else go(seq, "keychain");
}

// Clear all chips
{
  const seq = bfs(
    runner,
    220,
    2_000_000,
    (r) => r.playerState.chipsRemainingOnMap === 0,
    true,
  );
  if (!seq) throw new Error("chips fail");
  go(seq, "chips");
}

// Exit
{
  const seq = bfs(runner, 60, 600_000, (r) => r.completed, true);
  if (!seq) throw new Error("exit fail");
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
      "Yellow key → lock → hold E force → blocks to water → red ice → green×2 → key chain → bugs/blocks/bombs → socket → block on brown → exit",
    moveVerified: rem === 306,
    meetsBoldBudget: rem >= 306,
    moveSource: `Segment BFS StrategyWiki; rem ${rem} (bold 306)`,
    simulatedTicks: verify.buttonPressCtx.moveBoundary,
    simulatedSecondsRemaining: rem,
    boldGapNote:
      rem === 306
        ? undefined
        : `Completed with ${rem} remaining vs bold 306 (gap ${rem - 306})`,
  };
  writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
  console.log("wrote", webSolPath, "len", letters.length);
  writeFileSync(
    path.join(root, "_level009-route.json"),
    JSON.stringify({ letters, rem, moves, waits }, null, 2) + "\n",
  );
}
