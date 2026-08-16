import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const DIRS: Direction[] = ["up", "down", "left", "right"];

function expand(route: string): Direction[] {
  const out: Direction[] = [];
  const re = /(\d+)?([UDLR])/g;
  let m: RegExpExecArray | null;
  const map: Record<string, Direction> = {
    U: "up",
    D: "down",
    L: "left",
    R: "right",
  };
  while ((m = re.exec(route.replace(/\s/g, ""))) !== null) {
    const n = m[1] ? Number(m[1]) : 1;
    for (let i = 0; i < n; i++) out.push(map[m[2]!]!);
  }
  return out;
}

function runTo(route: string): MsCc1SimulationRunner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = "odd";
  for (const d of expand(route)) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied || r.completed) break;
  }
  return r;
}

function apply(r: MsCc1SimulationRunner, d: Direction): MsCc1SimulationRunner {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n;
}

const pre = "11D8R9U6L3D3U11R4DR5U5L5D8RL7D8L2U5D5LUD8LD";
const start = runTo(pre);
console.log("start", `${start.gx},${start.gy}`, "chips", start.playerState.chipsRemainingOnMap, "died", start.playerDied);
console.log(
  "monsters",
  start.monsters.filter((m) => m.alive).map((m) => `${m.x},${m.y}${m.direction[0]}`),
);

// Try escape U3R5U5L3U verbose
{
  let r = cloneMsCc1SimulationRunner(start);
  const esc = expand("U3R5U5L3U");
  for (let i = 0; i < esc.length; i++) {
    const before = `${r.gx},${r.gy}`;
    const mBefore = r.monsters
      .filter((m) => m.alive)
      .map((m) => `${m.x},${m.y}${m.direction[0]}`)
      .join(";");
    stepMsCc1Simulation(r, esc[i]!);
    console.log(
      `esc#${i + 1} ${esc[i]![0]!.toUpperCase()} ${before}->${r.gx},${r.gy} chips=${r.playerState.chipsRemainingOnMap}${r.playerDied ? " DEAD" : ""}`,
    );
    console.log(`  m: ${mBefore}`);
    console.log(
      `  → ${r.monsters
        .filter((m) => m.alive)
        .map((m) => `${m.x},${m.y}${m.direction[0]}`)
        .join(";")}`,
    );
    if (r.playerDied) break;
  }
}

// Local BFS escape: survive 30 moves while reducing danger / gaining north-east
type Item = { r: MsCc1SimulationRunner; path: Direction[] };
const q: Item[] = [{ r: start, path: [] }];
const seen = new Set<string>();
const key = (r: MsCc1SimulationRunner) => {
  const m = r.monsters
    .filter((x) => x.alive)
    .map((x) => `${x.x},${x.y}`)
    .join(";");
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${m}|${r.buttonPressCtx.moveBoundary % 2}`;
};
seen.add(key(start));

let bestSafe: { path: Direction[]; chips: number; pos: string; y: number } | null = null;
let expanded = 0;
while (q.length && expanded < 400_000) {
  const { r, path } = q.shift()!;
  expanded++;
  if (path.length >= 25) {
    // score: prefer north (low y), then fewer chips
    if (
      !bestSafe ||
      r.gy < bestSafe.y ||
      (r.gy === bestSafe.y && r.playerState.chipsRemainingOnMap < bestSafe.chips)
    ) {
      bestSafe = {
        path,
        chips: r.playerState.chipsRemainingOnMap,
        pos: `${r.gx},${r.gy}`,
        y: r.gy,
      };
    }
    continue;
  }
  for (const d of DIRS) {
    const nr = apply(r, d);
    if (nr.playerDied) continue;
    if (nr.gx === r.gx && nr.gy === r.gy) continue;
    const k = key(nr);
    if (seen.has(k)) continue;
    seen.add(k);
    q.push({ r: nr, path: [...path, d] });
  }
}
console.log("escape BFS", { expanded, seen: seen.size, bestSafe });

// From bestSafe, continue greedy chip BFS longer
if (bestSafe) {
  let cur = start;
  for (const d of bestSafe.path) stepMsCc1Simulation(cur, d);
  console.log("after escape bfs", `${cur.gx},${cur.gy}`, cur.playerState.chipsRemainingOnMap);

  // Keep collecting via short BFS goals for up to 200 more moves
  const all: Direction[] = expand(pre).concat(bestSafe.path);
  for (let turn = 0; turn < 200 && !cur.completed; turn++) {
    const chipsLeft = cur.playerState.chipsRemainingOnMap;
    type Q2 = { r: MsCc1SimulationRunner; path: Direction[] };
    const qq: Q2[] = [{ r: cur, path: [] }];
    const seen2 = new Set([key(cur)]);
    let found: Direction[] | null = null;
    let exp = 0;
    while (qq.length && exp < 80_000) {
      const { r, path } = qq.shift()!;
      exp++;
      if (path.length > 35) continue;
      const progress =
        chipsLeft === 0
          ? r.completed
          : r.playerState.chipsRemainingOnMap < chipsLeft || r.completed;
      if (progress && path.length) {
        found = path;
        break;
      }
      for (const d of DIRS) {
        const nr = apply(r, d);
        if (nr.playerDied) continue;
        if (nr.gx === r.gx && nr.gy === r.gy) continue;
        const k = key(nr);
        if (seen2.has(k)) continue;
        seen2.add(k);
        qq.push({ r: nr, path: [...path, d] });
      }
    }
    if (!found) {
      console.log("stuck at turn", turn, `${cur.gx},${cur.gy}`, chipsLeft);
      break;
    }
    for (const d of found) {
      stepMsCc1Simulation(cur, d);
      all.push(d);
      if (cur.playerDied || cur.completed) break;
    }
    if (cur.playerDied) {
      console.log("died during greedy", `${cur.gx},${cur.gy}`);
      break;
    }
    if (turn % 10 === 0) {
      console.log(
        "turn",
        turn,
        `${cur.gx},${cur.gy}`,
        "chips",
        cur.playerState.chipsRemainingOnMap,
        "mb",
        cur.buttonPressCtx.moveBoundary,
        "rem",
        msSecondsRemaining(210, cur.buttonPressCtx.moveBoundary),
      );
    }
  }
  console.log("final", {
    done: cur.completed,
    died: cur.playerDied,
    pos: `${cur.gx},${cur.gy}`,
    chips: cur.playerState.chipsRemainingOnMap,
    rem: msSecondsRemaining(210, cur.buttonPressCtx.moveBoundary),
    moves: all.length,
  });
}
