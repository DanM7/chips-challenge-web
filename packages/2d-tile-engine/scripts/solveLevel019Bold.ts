/**
 * Level 19 Digger — build StrategyWiki / TWS-hybrid bold route (odd step, rem 171).
 */
import { readFileSync, writeFileSync } from "node:fs";
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
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-019.json",
);
const levelPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
);

const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
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

function apply(
  runner: MsCc1SimulationRunner,
  dir: Direction,
): MsCc1SimulationRunner {
  const r = cloneMsCc1SimulationRunner(runner);
  stepMsCc1Simulation(r, dir);
  return r;
}

function run(
  moves: Direction[],
  parity: "even" | "odd" = "odd",
): MsCc1SimulationRunner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied || r.completed) break;
  }
  return r;
}

function status(r: MsCc1SimulationRunner, label: string) {
  const rem = msSecondsRemaining(210, r.buttonPressCtx.moveBoundary);
  console.log(
    label,
    `pos=${r.gx},${r.gy} chips=${r.playerState.chipsRemainingOnMap} mb=${r.buttonPressCtx.moveBoundary} rem=${rem} died=${r.playerDied}${r.deathMessage ? ":" + r.deathMessage : ""} done=${r.completed}`,
  );
}

// --- Phase A: TWS-aligned opening (follow chips) ---
// SW: to exit + 8U, 6L 2D, 3U 11R — TWS uses 11D8R9U6L3D3U11R
const open = expand("11D8R9U6L3D3U11R");
let r = run(open);
status(r, "open");

// SW: down to teeth, R 5U
// TWS continues: 3D6R4D4U6L2D5U8R ...
const mid1 = expand("11D8R9U6L3D3U11R3D6R4D4U6L2D5U");
r = run(mid1);
status(r, "mid1 after 5U");

// Try SW dodge 5L5D8R from here vs TWS 8R...
const swDodge = mid1.concat(expand("5L5D8R"));
r = run(swDodge);
status(r, "SW 5L5D8R");

const tws8R = mid1.concat(expand("8R"));
r = run(tws8R);
status(r, "TWS 8R");

// Continue TWS until death, report
const twsAll = expand(
  "11D8R9U6L3D3U11R3D6R4D4U6L2D5U8R8D2R2U2U3R2L2R3L3D2LD9U13L9D7R9D9L5U5R5L2D6L6R3D3LR2D2U2L13R4U9R9L7D6R3L4D4U5R8L2D5LUD8LR2L6R3D3U5LDU4R12U3R",
);
// Fix: use exact letters from file
const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { direction: number }[] };
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const twsDirs = sol.twsRecords
  .map((rec) => TWS_DIR[rec.direction])
  .filter((d): d is Direction => !!d);

r = run(twsDirs);
status(r, "full TWS dirs");

// Search: from start of dangerous section (after 5U / before 8R), BFS short escapes
const prefix = expand("11D8R9U6L3D3U11R3D6R4D4U6L2D5U");
const startR = run(prefix);
status(startR, "BFS start");

type Item = { r: MsCc1SimulationRunner; path: Direction[] };
const queue: Item[] = [{ r: startR, path: [] }];
const seen = new Set<string>();
function key(rr: MsCc1SimulationRunner): string {
  const mons = rr.monsters
    .filter((m) => m.alive)
    .map((m) => `${m.x},${m.y}`)
    .join(";");
  return `${rr.gx},${rr.gy}|${rr.playerState.chipsRemainingOnMap}|${mons}|${rr.buttonPressCtx.moveBoundary}`;
}
seen.add(key(startR));

let best: { path: Direction[]; rem: number; chips: number } | null = null;
let foundWin: Direction[] | null = null;
let expanded = 0;
const MAX = 200_000;
const goalChips = 0;

while (queue.length && expanded < MAX) {
  const { r: cur, path } = queue.shift()!;
  expanded++;
  if (cur.completed) {
    const rem = msSecondsRemaining(210, cur.buttonPressCtx.moveBoundary);
    console.log("WIN", path.length, "rem", rem, "mb", cur.buttonPressCtx.moveBoundary);
    foundWin = prefix.concat(path);
    if (rem >= 171) break;
    if (!best || rem > best.rem) best = { path: prefix.concat(path), rem, chips: 0 };
    continue;
  }
  if (cur.playerDied || path.length > 280) continue;
  // prune if too slow for bold
  if (cur.buttonPressCtx.moveBoundary > 220) continue;

  for (const d of DIRS) {
    const nr = apply(cur, d);
    if (nr.playerDied) continue;
    // skip no-ops (wall bumps) to limit branching — but MS bumps tick? our engine doesn't
    if (nr.gx === cur.gx && nr.gy === cur.gy && nr.buttonPressCtx.moveBoundary === cur.buttonPressCtx.moveBoundary) {
      continue;
    }
    const k = key(nr);
    if (seen.has(k)) continue;
    seen.add(k);
    queue.push({ r: nr, path: [...path, d] });
  }
}

console.log({
  expanded,
  seen: seen.size,
  foundWin: foundWin?.length,
  best: best ? { len: best.path.length, rem: best.rem } : null,
});

if (foundWin) {
  const verify = run(foundWin);
  const rem = msSecondsRemaining(210, verify.buttonPressCtx.moveBoundary);
  status(verify, "verify win");
  if (verify.completed && rem === 171) {
    const letters = foundWin.map((d) => LETTER[d]);
    const existing = JSON.parse(readFileSync(webSol, "utf8")) as Record<string, unknown>;
    const out = {
      ...existing,
      moves: letters,
      walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
      boldRouteHint:
        "Odd step; follow chips 11D8R9U6L3D3U11R…; teeth dodges; CCW chips; exit → 171",
      moveVerified: true,
      meetsBoldBudget: true,
      moveSource: `Engine search Digger odd-step; ${rem}s remaining (bold 171)`,
      simulatedTicks: verify.buttonPressCtx.moveBoundary,
      simulatedSecondsRemaining: rem,
      stepParity: "odd",
    };
    writeFileSync(webSol, JSON.stringify(out, null, 2) + "\n");
    console.log("WROTE", webSol, letters.length);
  }
}
