/**
 * Improve Hunt endgame: from a mid-route state (~150 chips), finish with
 * minimal waste ending adjacent to socket for short exit.
 *
 * Uses existing best verified route as prefix until chips hit threshold.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import { getCompositeTile } from "../engine/levelRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
);
const webSolPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-012.json",
);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const DIRS: Direction[] = ["up", "down", "left", "right"];
const SOCKETS = [
  [15, 14],
  [16, 14],
  [15, 17],
  [16, 17],
];

function loadLevel(): LevelData {
  const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function tryStep(r: Runner, d: Direction): Runner | null {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n.playerDied ? null : n;
}

function teethDist(r: Runner): number {
  let b = 99;
  for (const m of r.monsters) {
    if (!m.alive) continue;
    b = Math.min(b, Math.abs(m.x - r.gx) + Math.abs(m.y - r.gy));
  }
  return b;
}

function nearSocket(r: Runner): boolean {
  return SOCKETS.some(([x, y]) => Math.abs(r.gx - x!) + Math.abs(r.gy - y!) <= 1);
}

function chipFp(r: Runner): string {
  const upper = r.level.layers.upper as string[];
  let h = 0;
  let n = 0;
  for (let i = 0; i < upper.length; i++) {
    if (upper[i] === "chip") {
      h = (Math.imul(h, 131) + i) >>> 0;
      n++;
    }
  }
  return `${n}:${h}`;
}

function key(r: Runner): string {
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${chipFp(r)}|${r.monsters
    .map((m) => `${m.x},${m.y},${m.direction}`)
    .join(";")}|${r.buttonPressCtx.moveBoundary}`;
}

function verify(level: LevelData, moves: Direction[]) {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) return { ok: false, r };
    if (r.completed) return { ok: true, r };
  }
  return { ok: r.completed, r };
}

/** Beam endgame: minimize moves to chips=0 near socket, then exit. */
function endgameBeam(start: Runner, beamWidth: number, maxMoves: number): Direction[] | null {
  type N = { r: Runner; seq: Direction[]; waste: number };
  let beam: N[] = [{ r: start, seq: [], waste: 0 }];
  let bestZero: N | null = null;

  for (let depth = 0; depth < maxMoves; depth++) {
    const candidates: N[] = [];
    for (const node of beam) {
      if (node.r.playerState.chipsRemainingOnMap === 0) {
        if (
          !bestZero ||
          node.seq.length < bestZero.seq.length ||
          (node.seq.length === bestZero.seq.length && nearSocket(node.r) && !nearSocket(bestZero.r))
        ) {
          bestZero = node;
        }
        continue;
      }
      for (const d of DIRS) {
        const n = tryStep(node.r, d);
        if (!n) continue;
        if (n.gx === node.r.gx && n.gy === node.r.gy) continue;
        const chip =
          n.playerState.chipsRemainingOnMap < node.r.playerState.chipsRemainingOnMap;
        candidates.push({
          r: n,
          seq: [...node.seq, d],
          waste: node.waste + (chip ? 0 : 1),
        });
      }
    }
    if (bestZero && bestZero.waste === 0 && nearSocket(bestZero.r)) {
      // try exit
      break;
    }
    candidates.sort((a, b) => {
      const ca = a.r.playerState.chipsRemainingOnMap;
      const cb = b.r.playerState.chipsRemainingOnMap;
      if (ca !== cb) return ca - cb;
      if (a.waste !== b.waste) return a.waste - b.waste;
      // prefer near sockets when low chips
      const sa = SOCKETS.reduce(
        (m, [x, y]) => Math.min(m, Math.abs(a.r.gx - x!) + Math.abs(a.r.gy - y!)),
        99,
      );
      const sb = SOCKETS.reduce(
        (m, [x, y]) => Math.min(m, Math.abs(b.r.gx - x!) + Math.abs(b.r.gy - y!)),
        99,
      );
      if (ca < 40 && sa !== sb) return sa - sb;
      return teethDist(b.r) - teethDist(a.r);
    });
    const seen = new Set<string>();
    const next: N[] = [];
    for (const c of candidates) {
      const k = key(c.r);
      if (seen.has(k)) continue;
      seen.add(k);
      next.push(c);
      if (next.length >= beamWidth) break;
    }
    beam = next;
    if (!beam.length) break;
    if (depth % 20 === 0) {
      const b = beam[0]!;
      console.log(
        "eg",
        depth,
        "chips",
        b.r.playerState.chipsRemainingOnMap,
        "waste",
        b.waste,
        "pos",
        `${b.r.gx},${b.r.gy}`,
        "sock",
        SOCKETS.reduce(
          (m, [x, y]) => Math.min(m, Math.abs(b.r.gx - x!) + Math.abs(b.r.gy - y!)),
          99,
        ),
      );
    }
  }

  if (!bestZero) {
    // take best beam node if chips 0 somehow not recorded
    bestZero = beam.find((n) => n.r.playerState.chipsRemainingOnMap === 0) ?? null;
  }
  if (!bestZero) {
    console.error("endgame failed chips", beam[0]?.r.playerState.chipsRemainingOnMap);
    return null;
  }
  console.log("zero at", bestZero.seq.length, "waste", bestZero.waste, "pos", `${bestZero.r.gx},${bestZero.r.gy}`, "nearSock", nearSocket(bestZero.r));

  // Exit BFS
  const q: { seq: Direction[]; r: Runner }[] = [{ seq: [], r: bestZero.r }];
  const seen = new Set([`${bestZero.r.gx},${bestZero.r.gy}|${bestZero.r.monsters.map((m) => `${m.x},${m.y}`).join(";")}`]);
  while (q.length) {
    const f = q.shift()!;
    if (f.r.completed) return [...bestZero.seq, ...f.seq];
    if (f.seq.length >= 30) continue;
    for (const d of DIRS) {
      const n = tryStep(f.r, d);
      if (!n) continue;
      if (n.completed) return [...bestZero.seq, ...f.seq, d];
      if (n.gx === f.r.gx && n.gy === f.r.gy) continue;
      const k = `${n.gx},${n.gy}|${n.monsters.map((m) => `${m.x},${m.y}`).join(";")}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], r: n });
    }
  }
  console.error("no exit from zero");
  return null;
}

const level = loadLevel();
const entry = JSON.parse(fs.readFileSync(webSolPath, "utf8"));
const full = decodeSolutionMoves(entry.moves) as Direction[];
console.log("base moves", full.length, "rem", entry.simulatedSecondsRemaining);

// Find prefix until chips == threshold
const thresholds = [180, 150, 120, 100, 80];
let bestRoute: Direction[] | null = null;
let bestRem = entry.simulatedSecondsRemaining ?? 0;

for (const thr of thresholds) {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  const prefix: Direction[] = [];
  for (const d of full) {
    const n = tryStep(r, d);
    if (!n) break;
    prefix.push(d);
    r = n;
    if (r.playerState.chipsRemainingOnMap <= thr) break;
    if (r.completed) break;
  }
  console.log("\nthreshold", thr, "prefix", prefix.length, "chips", r.playerState.chipsRemainingOnMap, "pos", `${r.gx},${r.gy}`);
  if (r.playerState.chipsRemainingOnMap > thr) continue;

  const eg = endgameBeam(r, 40, thr + 40);
  if (!eg) continue;
  const route = [...prefix, ...eg];
  const v = verify(level, route);
  const rem = msSecondsRemaining(400, v.r.buttonPressCtx.moveBoundary);
  console.log("result thr", thr, { ok: v.ok, moves: route.length, ticks: v.r.buttonPressCtx.moveBoundary, rem });
  if (v.ok && rem > bestRem) {
    bestRem = rem;
    bestRoute = route;
  }
  if (v.ok && rem === 270) {
    bestRoute = route;
    bestRem = rem;
    break;
  }
}

if (!bestRoute) {
  console.error("no improvement");
  process.exit(1);
}

const v = verify(level, bestRoute);
const rem = msSecondsRemaining(400, v.r.buttonPressCtx.moveBoundary);
const out = {
  levelId: "level-012",
  passwordMs: "WVHI",
  title: "Hunt",
  timeLimitSeconds: 400,
  boldTimeRemaining: 270,
  minChipMoves: 130,
  moves: encodeSolutionMoves(bestRoute),
  source: "https://scores.bitbusters.club/levels/cc1/12/ms",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
  boldRouteHint:
    "TWS-hybrid prefix + center endgame beam; chipsRequired 652",
  moveVerified: v.ok && rem === 270,
  meetsBoldBudget: v.ok && rem >= 270,
  moveSource: `endgame-optimized; rem ${rem} (bold 270)`,
  simulatedTicks: v.r.buttonPressCtx.moveBoundary,
  simulatedSecondsRemaining: rem,
};
fs.writeFileSync(webSolPath, `${JSON.stringify(out, null, 2)}\n`);
console.log("wrote", { rem, exact: rem === 270, moves: bestRoute.length, verified: out.moveVerified });
