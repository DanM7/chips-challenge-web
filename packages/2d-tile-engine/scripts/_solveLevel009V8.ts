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
import { getCompositeTile, isDirtCell } from "../engine/levelRuntime.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const webSolPath = path.join(
  root,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-009.json",
);

const dirs: Direction[] = ["up", "down", "left", "right"];
const LETTER: Record<Direction, string> = { up: "U", down: "D", left: "L", right: "R" };
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
    for (let i = 0; i < c; i++)
      out.push(ch === "W" ? "wait" : ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right");
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

function stateKey(r: MsCc1SimulationRunner, monsters: boolean): string {
  const parts: string[] = [
    `${r.gx},${r.gy}`,
    `c${r.playerState.chipsRemainingOnMap}`,
    `k${[...r.playerState.keys].sort().join(",")}`,
  ];
  for (let y = 0; y < r.level.height; y++) {
    for (let x = 0; x < r.level.width; x++) {
      const t = getCompositeTile(r.level, x, y);
      if (t === "block_movable") parts.push(`b${x},${y}`);
      if (t.startsWith("block_toggle")) parts.push(`t${x},${y}${t.at(-1)}`);
      if (t.startsWith("door_")) parts.push(`d${x},${y}`);
      if (t === "bomb") parts.push(`o${x},${y}`);
      if (isDirtCell(r.level, x, y)) parts.push(`w${x},${y}`);
    }
  }
  if (monsters) for (const m of r.monsters) parts.push(`m${m.kind[0]}${m.x},${m.y}`);
  return parts.join("|");
}

function bfs(
  start: MsCc1SimulationRunner,
  maxDepth: number,
  maxNodes: number,
  done: (r: MsCc1SimulationRunner) => boolean,
  opts: { wait?: boolean; monsters?: boolean } = {},
): Act[] | null {
  type N = { seq: Act[]; r: MsCc1SimulationRunner };
  const q: N[] = [{ seq: [], r: cloneMsCc1SimulationRunner(start) }];
  const seen = new Set([stateKey(start, !!opts.monsters)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (done(f.r)) {
      console.log("bfs", nodes, toLetters(f.seq).join(""), `->${f.r.gx},${f.r.gy} c=${f.r.playerState.chipsRemainingOnMap}`);
      return f.seq;
    }
    if (f.r.playerDied || f.seq.length >= maxDepth) continue;
    const acts: Act[] = opts.wait ? [...dirs, "wait"] : [...dirs];
    for (const a of acts) {
      const n = cloneMsCc1SimulationRunner(f.r);
      if (a === "wait") stepMsCc1Wait(n);
      else stepMsCc1Simulation(n, a);
      if (n.playerDied) continue;
      const k = stateKey(n, !!opts.monsters);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, a], r: n });
    }
  }
  console.error("fail", nodes, seen.size);
  return null;
}

function bombCount(level: LevelData): number {
  let n = 0;
  for (let y = 0; y < level.height; y++)
    for (let x = 0; x < level.width; x++) if (getCompositeTile(level, x, y) === "bomb") n++;
  return n;
}

const route: Act[] = [];
let runner = createMsCc1SimulationRunner(structuredClone(level));
function go(seq: Act[], label: string): void {
  applyActs(runner, seq);
  route.push(...seq);
  console.log(
    label,
    toLetters(seq).join(""),
    `pos=${runner.gx},${runner.gy} chips=${runner.playerState.chipsRemainingOnMap} keys=${runner.playerState.keys.join("+") || "-"} bombs=${bombCount(runner.level)}`,
    runner.playerDied ? runner.deathMessage : "",
  );
  if (runner.playerDied) throw new Error(label);
}

// Verified prefix through to-bugs from V7
const PREFIX =
  "RRRRLLDDDDUUUURRRRRRUURRRDRUUUDDDLLDRDRUUUUUUDDDLLLLDRRRDRUUUUUUDDDDDLLLLDRRRDRUUUUUUUUUDDDDDRRURRDLULDRULDR" +
  "RDLULUU" +
  "UD" +
  "UUUUUUUUUUU" +
  "DUDDDDDLLLLRRRRDDDDDDUUUULLLLRRRRDWDDDUUUUUURRRR" +
  "LLLLDDDDRRRRRRUUR";
go(expand(PREFIX), "prefix");

// Collect chips one at a time
while (runner.playerState.chipsRemainingOnMap > 0) {
  const before = runner.playerState.chipsRemainingOnMap;
  const seq = bfs(
    runner,
    120,
    1_500_000,
    (r) => r.playerState.chipsRemainingOnMap < before,
    { wait: true, monsters: true },
  );
  if (!seq) {
    // try reducing bombs first (sokoban)
    const bombsBefore = bombCount(runner.level);
    if (bombsBefore > 0) {
      const bseq = bfs(
        runner,
        80,
        1_000_000,
        (r) => bombCount(r.level) < bombsBefore,
        { wait: true, monsters: true },
      );
      if (bseq) {
        go(bseq, `bomb-${bombsBefore}`);
        continue;
      }
    }
    throw new Error(`chip from ${before}`);
  }
  go(seq, `chip-${before}`);
}

{
  const seq = bfs(runner, 80, 800_000, (r) => r.completed, { wait: true, monsters: true });
  if (!seq) throw new Error("exit");
  go(seq, "exit");
}

const verify = createMsCc1SimulationRunner(structuredClone(level));
applyActs(verify, route);
const rem = msSecondsRemaining(400, verify.buttonPressCtx.moveBoundary);
const letters = toLetters(route);
console.log({
  completed: verify.completed,
  rem,
  exact: rem === 306,
  moves: letters.filter((c) => c !== "W").length,
  waits: letters.filter((c) => c === "W").length,
  ticks: verify.buttonPressCtx.moveBoundary,
});

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
          "Yellow → force E → bridges → red ice → green×2 → key chain → bugs/sokoban/bombs → socket → block on brown → exit",
        moveVerified: rem === 306,
        meetsBoldBudget: rem >= 306,
        moveSource: `StrategyWiki + BFS; rem ${rem} (bold 306)`,
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
