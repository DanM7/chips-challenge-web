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
import { isDirtCell } from "../engine/levelRuntime.js";
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

function expand(n: string): Act[] {
  const out: Act[] = [];
  const re = /(\d*)([UDLRW])/g;
  let m: RegExpExecArray | null;
  const s = n.replace(/\s+/g, "");
  while ((m = re.exec(s))) {
    const c = m[1] ? Number.parseInt(m[1], 10) : 1;
    const ch = m[2]!;
    for (let i = 0; i < c; i++) {
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

function waterN(l: LevelData): number {
  let n = 0;
  for (let y = 20; y <= 23; y++) if (getCompositeTile(l, 16, y) === "water") n++;
  return n;
}

function roomKey(r: MsCc1SimulationRunner): string {
  const b: string[] = [];
  const dirt: string[] = [];
  for (let y = 19; y <= 28; y++) {
    for (let x = 11; x <= 17; x++) {
      if (getCompositeTile(r.level, x, y) === "block_movable") b.push(`${x},${y}`);
      if (isDirtCell(r.level, x, y)) dirt.push(`${x},${y}`);
    }
  }
  return `${r.gx},${r.gy}|b${b.join(";")}|d${dirt.join(";")}|c${r.playerState.chipsRemainingOnMap}|k${r.playerState.keys.join(",")}`;
}

function dump(r: MsCc1SimulationRunner, label: string): void {
  console.log(
    label,
    `pos=${r.gx},${r.gy} w=${waterN(r.level)} chips=${r.playerState.chipsRemainingOnMap} keys=${r.playerState.keys.join("+") || "-"} died=${r.playerDied}`,
    r.deathMessage ?? "",
  );
  for (let y = 19; y <= 28; y++) {
    let row = `${y}: `;
    for (let x = 11; x <= 17; x++) {
      if (x === r.gx && y === r.gy) {
        row += "C";
        continue;
      }
      const t = getCompositeTile(r.level, x, y);
      const d = isDirtCell(r.level, x, y);
      row += d
        ? "~"
        : t === "empty"
          ? "."
          : t === "wall"
            ? "#"
            : t === "block_movable"
              ? "B"
              : t === "water"
                ? "W"
                : t === "key_red"
                  ? "K"
                  : t[0]!;
    }
    console.log(row);
  }
}

function bfs2(
  start: MsCc1SimulationRunner,
  maxDepth: number,
  maxNodes: number,
  done: (r: MsCc1SimulationRunner) => boolean,
  allowWait = false,
): Act[] | null {
  type N = { seq: Act[]; r: MsCc1SimulationRunner };
  const q: N[] = [{ seq: [], r: cloneMsCc1SimulationRunner(start) }];
  const seen = new Set([roomKey(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (done(f.r)) {
      console.log("bfs", nodes, toLetters(f.seq).join(""));
      return f.seq;
    }
    if (f.r.playerDied || f.seq.length >= maxDepth) continue;
    const acts: Act[] = allowWait ? [...dirs, "wait"] : [...dirs];
    for (const a of acts) {
      const next = cloneMsCc1SimulationRunner(f.r);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied) continue;
      const k = roomKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, a], r: next });
    }
  }
  console.error("fail", nodes, seen.size);
  return null;
}

const route: Act[] = [];
let runner = createMsCc1SimulationRunner(structuredClone(level));

function go(seq: Act[], label: string): void {
  applyActs(runner, seq);
  route.push(...seq);
  dump(runner, `${label} ${toLetters(seq).join("")}`);
  if (runner.playerDied) throw new Error(label);
}

go(expand("4R2L4D"), "1");
go(expand("4U5R"), "2");
go(expand("RUURRRDRUU"), "b1");

// Dry dirt then fill remaining waters one by one
while (waterN(runner.level) > 0) {
  const before = waterN(runner.level);
  // First dry any dirt on column 16 if present
  if (isDirtCell(runner.level, 16, 23) || isDirtCell(runner.level, 16, 22) || isDirtCell(runner.level, 16, 21) || isDirtCell(runner.level, 16, 20)) {
    const dry = bfs2(
      runner,
      20,
      100_000,
      (r) =>
        !isDirtCell(r.level, 16, 20) &&
        !isDirtCell(r.level, 16, 21) &&
        !isDirtCell(r.level, 16, 22) &&
        !isDirtCell(r.level, 16, 23),
    );
    if (dry && dry.length) go(dry, `dry-${before}`);
  }
  const seq = bfs2(runner, 50, 1_000_000, (r) => waterN(r.level) < before);
  if (!seq) throw new Error(`bridge ${before}`);
  go(seq, `b${before}`);
}

{
  const seq = bfs2(runner, 20, 100_000, (r) =>
    r.playerState.keys.some((k) => k.includes("red")),
  );
  if (!seq) throw new Error("red");
  go(seq, "red");
}

console.log("TO RED", toLetters(route).join(""), "len", route.length);

// Ice path
{
  const enter = bfs2(runner, 40, 300_000, (r) => {
    const t = getCompositeTile(r.level, r.gx, r.gy);
    return t === "ice" || t.startsWith("ice");
  });
  if (!enter) throw new Error("ice enter");
  go(enter, "ice-enter");
  const ice = expand("RDLULDRULD2RDLULU");
  const trial = cloneMsCc1SimulationRunner(runner);
  applyActs(trial, ice);
  console.log("ice trial", trial.gx, trial.gy, trial.playerDied, trial.deathMessage, "chips", trial.playerState.chipsRemainingOnMap);
  if (!trial.playerDied) go(ice, "ice");
  else {
    const seq = bfs2(runner, 60, 500_000, (r) => r.gx >= 19 && r.gy <= 22);
    if (!seq) throw new Error("ice");
    go(seq, "ice");
  }
}

function fullKey(r: MsCc1SimulationRunner): string {
  const mons = r.monsters.map((m) => `${m.kind[0]}${m.x},${m.y},${m.dir ?? ""}`).join(";");
  return roomKey(r) + "|" + mons;
}

function bfsFull(
  start: MsCc1SimulationRunner,
  maxDepth: number,
  maxNodes: number,
  done: (r: MsCc1SimulationRunner) => boolean,
  allowWait = false,
): Act[] | null {
  type N = { seq: Act[]; r: MsCc1SimulationRunner };
  const q: N[] = [{ seq: [], r: cloneMsCc1SimulationRunner(start) }];
  const seen = new Set([fullKey(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (done(f.r)) {
      console.log("bfsFull", nodes, toLetters(f.seq).join(""));
      return f.seq;
    }
    if (f.r.playerDied || f.seq.length >= maxDepth) continue;
    const acts: Act[] = allowWait ? [...dirs, "wait"] : [...dirs];
    for (const a of acts) {
      const next = cloneMsCc1SimulationRunner(f.r);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied) continue;
      const k = fullKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, a], r: next });
    }
  }
  console.error("failFull", nodes, seen.size);
  return null;
}

{
  const seq = bfsFull(runner, 160, 2_000_000, (r) => r.gx <= 14 && r.gy <= 10, true);
  if (!seq) throw new Error("keychain");
  go(seq, "keychain");
}
{
  const seq = bfsFull(runner, 280, 3_000_000, (r) => r.playerState.chipsRemainingOnMap === 0, true);
  if (!seq) throw new Error("chips");
  go(seq, "chips");
}
{
  const seq = bfsFull(runner, 100, 1_000_000, (r) => r.completed, true);
  if (!seq) throw new Error("exit");
  go(seq, "exit");
}

const verify = createMsCc1SimulationRunner(structuredClone(level));
applyActs(verify, route);
const rem = msSecondsRemaining(400, verify.buttonPressCtx.moveBoundary);
const letters = toLetters(route);
const moves = letters.filter((c) => c !== "W").length;
const waits = letters.filter((c) => c === "W").length;
console.log({ completed: verify.completed, rem, exact: rem === 306, moves, waits, ticks: verify.buttonPressCtx.moveBoundary });

if (verify.completed) {
  writeFileSync(
    webSolPath,
    `${JSON.stringify(
      {
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
          "Yellow → force hold E → blocks/dry dirt bridges → red ice → green×2 → keys → bugs/sokoban/bombs → socket → block on brown → exit",
        moveVerified: rem === 306,
        meetsBoldBudget: rem >= 306,
        moveSource: `StrategyWiki + BFS with dirt drying; rem ${rem} (bold 306)`,
        simulatedTicks: verify.buttonPressCtx.moveBoundary,
        simulatedSecondsRemaining: rem,
        boldGapNote: rem === 306 ? undefined : `rem ${rem} vs bold 306 (gap ${rem - 306})`,
      },
      null,
      2,
    )}\n`,
  );
  console.log("wrote", webSolPath);
}
