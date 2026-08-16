import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-019.json",
);
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
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

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

function run(moves: Direction[], parity: "even" | "odd"): MsCc1SimulationRunner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (const d of moves) {
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

for (const parity of ["odd", "even"] as const) {
  const start = run(expand(pre), parity);
  console.log("\n===", parity, `${start.gx},${start.gy}`, "mb", start.buttonPressCtx.moveBoundary, "died", start.playerDied);
  if (start.playerDied) continue;

  // Try slip: if next move would be teeth-moving, first do a safe tempo move
  // Search short escape paths (max 20) that reach y<=15 and x>=5
  type Item = { r: MsCc1SimulationRunner; path: Direction[] };
  const q: Item[] = [{ r: start, path: [] }];
  const seen = new Set<string>();
  const key = (r: MsCc1SimulationRunner) => {
    const m = r.monsters
      .filter((x) => x.alive)
      .map((x) => `${x.x},${x.y}${x.direction[0]}`)
      .join(";");
    return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${m}|${r.buttonPressCtx.moveBoundary % 2}`;
  };
  seen.add(key(start));
  let goal: Direction[] | null = null;
  let expanded = 0;
  while (q.length && expanded < 200_000) {
    const { r, path } = q.shift()!;
    expanded++;
    if (r.gy <= 14 && r.gx >= 8 && path.length >= 8) {
      goal = path;
      console.log(
        "escaped to",
        `${r.gx},${r.gy}`,
        "pathlen",
        path.length,
        "chips",
        r.playerState.chipsRemainingOnMap,
        "mb",
        r.buttonPressCtx.moveBoundary,
      );
      break;
    }
    if (path.length >= 30) continue;
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
  console.log("escape search", { expanded, seen: seen.size, found: !!goal });

  if (!goal) continue;

  // Continue: BFS collect all chips + exit with mb cap 199 for exact bold
  const prefix = expand(pre).concat(goal);
  let cur = run(prefix, parity);
  const all = [...prefix];

  // Iterative deepest: BFS until chip collected or exit, prefer short
  let stuck = false;
  while (!cur.completed && !stuck) {
    const chipsLeft = cur.playerState.chipsRemainingOnMap;
    type Q2 = { r: MsCc1SimulationRunner; path: Direction[] };
    const qq: Q2[] = [{ r: cur, path: [] }];
    const seen2 = new Set([key(cur)]);
    let found: Direction[] | null = null;
    let exp = 0;
    while (qq.length && exp < 150_000) {
      const { r, path } = qq.shift()!;
      exp++;
      if (path.length > 45) continue;
      if (r.buttonPressCtx.moveBoundary > 205) continue;
      const ok =
        chipsLeft === 0
          ? r.completed
          : r.playerState.chipsRemainingOnMap < chipsLeft || r.completed;
      if (ok && path.length) {
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
      console.log("collect stuck", `${cur.gx},${cur.gy}`, chipsLeft, "mb", cur.buttonPressCtx.moveBoundary);
      stuck = true;
      break;
    }
    for (const d of found) {
      stepMsCc1Simulation(cur, d);
      all.push(d);
      if (cur.playerDied || cur.completed) break;
    }
    if (cur.playerDied) {
      console.log("died collecting", `${cur.gx},${cur.gy}`);
      stuck = true;
      break;
    }
    if (all.length % 20 === 0) {
      console.log(
        "progress chips",
        cur.playerState.chipsRemainingOnMap,
        "mb",
        cur.buttonPressCtx.moveBoundary,
        "rem",
        msSecondsRemaining(210, cur.buttonPressCtx.moveBoundary),
      );
    }
  }

  if (cur.completed) {
    const rem = msSecondsRemaining(210, cur.buttonPressCtx.moveBoundary);
    console.log("WIN", parity, "rem", rem, "moves", all.length, "mb", cur.buttonPressCtx.moveBoundary);
    const letters = all.map((d) => LETTER[d]);
    const existing = JSON.parse(readFileSync(webSol, "utf8")) as Record<string, unknown>;
    const out = {
      ...existing,
      moves: letters,
      walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
      boldRouteHint: `${parity} step; SW hybrid + BFS escape/collect → exit`,
      moveVerified: true,
      meetsBoldBudget: rem >= 171,
      moveSource: `Engine Digger ${parity}-step; ${rem}s remaining (bold 171)`,
      simulatedTicks: cur.buttonPressCtx.moveBoundary,
      simulatedSecondsRemaining: rem,
      stepParity: parity,
    };
    writeFileSync(webSol, JSON.stringify(out, null, 2) + "\n");
    console.log("WROTE", rem === 171 ? "EXACT" : rem);
    if (rem === 171) process.exit(0);
  }
}
