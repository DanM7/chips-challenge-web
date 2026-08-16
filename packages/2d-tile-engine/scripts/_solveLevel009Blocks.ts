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

function expand(notation: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  for (const tok of notation.trim().split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLRW])$/);
    if (!m) throw new Error(tok);
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i++) {
      if (m[2] === "W") throw new Error("use waits separately");
      out.push(map[m[2]!]!);
    }
  }
  return out;
}

function toLetters(seq: Act[]): string[] {
  return seq.map((a) => (a === "wait" ? "W" : LETTER[a]));
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
  console.error("fail nodes", nodes, "depth", maxDepth);
  return null;
}

function applyActs(r: MsCc1SimulationRunner, seq: Act[]): void {
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
}

function blocksNear(level: LevelData): string {
  const out: string[] = [];
  for (let y = 18; y < 32; y++) {
    for (let x = 10; x < 20; x++) {
      if (getCompositeTile(level, x, y) === "block_movable") out.push(`${x},${y}`);
    }
  }
  return out.join(" ");
}

function waterCol(level: LevelData): string {
  const out: string[] = [];
  for (let y = 18; y <= 24; y++) {
    out.push(`${y}:${getCompositeTile(level, 16, y)}`);
  }
  return out.join(" ");
}

const route: Act[] = [];
let runner = createMsCc1SimulationRunner(structuredClone(level));

function go(seq: Act[], label: string): void {
  applyActs(runner, seq);
  route.push(...seq);
  console.log(
    label,
    toLetters(seq).join(""),
    `pos=${runner.gx},${runner.gy}`,
    `chips=${runner.playerState.chipsRemainingOnMap}`,
    `keys=${runner.playerState.keys.join("+") || "-"}`,
    `mb=${runner.buttonPressCtx.moveBoundary}`,
    `blocks=[${blocksNear(runner.level)}]`,
    `water=[${waterCol(runner.level)}]`,
    runner.playerDied ? runner.deathMessage : "",
  );
  if (runner.playerDied) throw new Error(label);
}

// 1) chip + yellow
{
  const seq = bfs(
    runner,
    25,
    200_000,
    (r) =>
      r.playerState.keys.some((k) => k.includes("yellow")) &&
      r.playerState.chipsRemainingOnMap <= 8,
  )!;
  go(seq, "1-yellow");
}

// 2) to block room (after force hold)
{
  const seq = bfs(
    runner,
    40,
    400_000,
    (r) => r.gx >= 11 && r.gy >= 25 && r.gy <= 28 && !r.playerState.keys.some((k) => k.includes("yellow")),
  )!;
  go(seq, "2-blocks");
}

// Dump local map around Chip
console.log("local map:");
for (let y = runner.gy - 3; y <= runner.gy + 3; y++) {
  let row = `${y}: `;
  for (let x = runner.gx - 3; x <= runner.gx + 6; x++) {
    if (x === runner.gx && y === runner.gy) {
      row += "C";
      continue;
    }
    const t = getCompositeTile(runner.level, x, y);
    row +=
      t === "empty"
        ? "."
        : t === "wall"
          ? "#"
          : t === "block_movable"
            ? "B"
            : t === "water"
              ? "~"
              : t === "chip"
                ? "c"
                : t.startsWith("key")
                  ? "K"
                  : t.startsWith("force")
                    ? "F"
                    : t.includes("blue") || t.includes("fake") || t === "wall_blue" || t === "wall_invisible"
                      ? "?"
                      : t[0] ?? "?";
  }
  console.log(row);
}

// Manual StrategyWiki block section — try several scripted push sequences
const pushAttempts = [
  // From SW: block in front 2U, RDR, block4, then three to water
  "2R 2U 2D R D R", // push nearest block 2U then RDR
  "R 2U", // just push first block 2U
  "2R U", 
  "R U R U",
  "2R 2U L 2D 2R U R U R U R U",
  "R 2U 2D R D R 2U R U R U R U R U R U",
];

for (const notation of pushAttempts) {
  const r = cloneMsCc1SimulationRunner(runner);
  try {
    applyActs(r, expand(notation));
  } catch {
    continue;
  }
  console.log(
    "try",
    notation,
    `pos=${r.gx},${r.gy}`,
    `keys=${r.playerState.keys.join("+") || "-"}`,
    `died=${r.playerDied}`,
    r.deathMessage ?? "",
    `blocks=[${blocksNear(r.level)}]`,
    `water=[${waterCol(r.level)}]`,
  );
}

// Smaller BFS from block room just to get a block into water
{
  const seq = bfs(
    runner,
    30,
    300_000,
    (r) => {
      for (let y = 20; y <= 23; y++) {
        if (getCompositeTile(r.level, 16, y) !== "water") return true;
      }
      return false;
    },
  );
  console.log("first-water-bridge", seq && toLetters(seq).join(""));
  if (seq) {
    go(seq, "3a-first-bridge");
  }
}

// Continue to red key with bounded BFS from current
{
  const seq = bfs(
    runner,
    80,
    800_000,
    (r) => r.playerState.keys.some((k) => k.includes("red")),
  );
  console.log("red", seq && toLetters(seq).join(""));
  if (seq) go(seq, "3-red");
}

console.log("route so far", toLetters(route).join(""));
