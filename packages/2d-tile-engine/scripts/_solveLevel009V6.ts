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

function puzzleKey(r: MsCc1SimulationRunner, withMonsters: boolean): string {
  const b: string[] = [];
  const extra: string[] = [];
  for (let y = 0; y < r.level.height; y++) {
    for (let x = 0; x < r.level.width; x++) {
      const t = getCompositeTile(r.level, x, y);
      if (t === "block_movable") b.push(`${x},${y}`);
      if (t === "block_toggle_open" || t === "block_toggle_closed") extra.push(`t${x},${y}:${t.at(-1)}`);
      if (t.startsWith("door_")) extra.push(`d${x},${y}`);
      if (isDirtCell(r.level, x, y)) extra.push(`dirt${x},${y}`);
    }
  }
  const base = [
    `${r.gx},${r.gy}`,
    `c${r.playerState.chipsRemainingOnMap}`,
    `k${[...r.playerState.keys].sort().join(",")}`,
    `b${b.join(";")}`,
    extra.sort().join(";"),
  ].join("|");
  if (!withMonsters) return base;
  const mons = r.monsters.map((m) => `${m.kind[0]}${m.x},${m.y}`).join(";");
  return `${base}|${mons}`;
}

function bfs(
  start: MsCc1SimulationRunner,
  maxDepth: number,
  maxNodes: number,
  done: (r: MsCc1SimulationRunner) => boolean,
  opts: { allowWait?: boolean; withMonsters?: boolean } = {},
): Act[] | null {
  const allowWait = opts.allowWait ?? false;
  const withMonsters = opts.withMonsters ?? false;
  type N = { seq: Act[]; r: MsCc1SimulationRunner };
  const q: N[] = [{ seq: [], r: cloneMsCc1SimulationRunner(start) }];
  const seen = new Set([puzzleKey(start, withMonsters)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (done(f.r)) {
      console.log("bfs", nodes, toLetters(f.seq).join(""), `pos=${f.r.gx},${f.r.gy}`);
      return f.seq;
    }
    if (f.r.playerDied || f.seq.length >= maxDepth) continue;
    const acts: Act[] = allowWait ? [...dirs, "wait"] : [...dirs];
    for (const a of acts) {
      const next = cloneMsCc1SimulationRunner(f.r);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied) continue;
      const k = puzzleKey(next, withMonsters);
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
  console.log(
    label,
    toLetters(seq).join(""),
    `pos=${runner.gx},${runner.gy} chips=${runner.playerState.chipsRemainingOnMap} keys=${runner.playerState.keys.join("+") || "-"} mb=${runner.buttonPressCtx.moveBoundary}`,
    runner.playerDied ? runner.deathMessage : "",
  );
  if (runner.playerDied) throw new Error(label);
}

// Known route to red key (from V5)
go(
  expand(
    "RRRRLLDDDDUUUURRRRRRUURRRDRUUUDDDLLDRDRUUUUUUDDDLLLLDRRRDRUUUUUUDDDDDLLLLDRRRDRUUUUUUUUU",
  ),
  "to-red",
);

// Open red door at (19,23) and enter ice rink — land somewhere in ice area
{
  const seq = bfs(
    runner,
    80,
    500_000,
    (r) => r.gx >= 20 && r.gy >= 22 && !r.playerState.keys.includes("key_red"),
  );
  if (!seq) throw new Error("red door/ice");
  go(seq, "red-door");
}

// Try SW ice path from current pos; else BFS to chip on ice / exit ice north
{
  const ice = expand("RDLULDRULD2RDLULU");
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
    const seq = bfs(
      runner,
      80,
      800_000,
      (r) => r.playerState.chipsRemainingOnMap <= 7 || (r.gx >= 20 && r.gy <= 20),
      { withMonsters: true },
    );
    if (!seq) throw new Error("ice");
    go(seq, "ice");
  }
}

// Green button twice + key chain → bugs room (NW)
{
  const seq = bfs(
    runner,
    180,
    2_000_000,
    (r) => r.gx <= 14 && r.gy <= 10,
    { allowWait: true, withMonsters: true },
  );
  if (!seq) throw new Error("keychain");
  go(seq, "keychain");
}

{
  const seq = bfs(
    runner,
    300,
    3_000_000,
    (r) => r.playerState.chipsRemainingOnMap === 0,
    { allowWait: true, withMonsters: true },
  );
  if (!seq) throw new Error("chips");
  go(seq, "chips");
}

{
  const seq = bfs(
    runner,
    120,
    1_500_000,
    (r) => r.completed,
    { allowWait: true, withMonsters: true },
  );
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
  rem,
  exact: rem === 306,
  moves,
  waits,
  ticks: verify.buttonPressCtx.moveBoundary,
  len: letters.length,
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
          "Yellow → force hold E → dirt-dry block bridges → red door ice → green×2 → key chain → bugs/blocks/bombs → socket → block on brown → exit",
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
