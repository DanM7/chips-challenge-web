import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const r0 = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < 445; i++) stepMsCc1Simulation(r0, tws[i]!);

function blockPos(r: Runner): string {
  for (let y = 8; y <= 16; y++)
    for (let x = 14; x <= 20; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  // wider search
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "gone";
}

function run(seq: string) {
  const r = cloneMsCc1SimulationRunner(r0);
  for (const c of seq) {
    const d =
      c === "U" ? "up" : c === "D" ? "down" : c === "L" ? "left" : "right";
    stepMsCc1Simulation(r, d as Direction);
    if (r.playerDied) break;
  }
  return {
    seq,
    pos: `${r.gx},${r.gy}`,
    block: blockPos(r),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    blue: cellTile(r.level, "upper", 16, 11),
    keys: r.playerState.keys,
    died: r.playerDied,
    death: r.deathMessage,
    ticks: r.buttonPressCtx.moveBoundary,
  };
}

const variants = [
  // open blue via north, return, push LL, around, UUUU
  "ULLLUDDRRRLLDLUUUU",
  "ULLLU DDRRR LL DL UUUU".replace(/ /g, ""),
  "ULLLURDDRRLLDLUUUU",
  // open blue, push from south
  "ULLLUDDRRRLLUUUU",
  "U LLLU D D R R R L L D L U U U U".replace(/ /g, ""),
  // only push LL without opening first — can block pass closed door?
  "LLDLUUUU",
  "LLDLUUU",
  // open door from (19,12)
  "ULLLLDDRRRULLDLUUUU",
  "ULLLUDRRRLLDLUUUU",
  "ULLLUDDRRRDLLUUUU",
  "ULLLUDDRRRLLULUUUU",
  "ULLLUDDRRRLLDLUUUUR",
];

for (const v of variants) {
  const r = run(v);
  const ok = r.block === "16,9" && r.trap && !r.died;
  console.log(ok ? "OK" : "  ", r);
}

// BFS again - avoid pushing block to x=15
const dirs: Direction[] = ["up", "down", "left", "right"];
type Frame = { seq: Direction[]; runner: Runner };
const q: Frame[] = [{ seq: [], runner: r0 }];
const seen = new Set<string>();
const keyOf = (x: Runner) => `${x.gx},${x.gy}|${blockPos(x)}|${x.playerState.keys.join("+")}|${cellTile(x.level, "upper", 16, 11)}`;
seen.add(keyOf(r0));
let qi = 0;
let found: Direction[] | null = null;
while (qi < q.length && qi < 2_000_000) {
  const f = q[qi++]!;
  const bp = blockPos(f.runner);
  // prune: block west of 16 is stuck for our purpose
  if (bp.startsWith("15,") || bp.startsWith("14,")) continue;
  if (bp === "16,9") {
    found = f.seq;
    break;
  }
  if (f.seq.length >= 35 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const next = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(next, d);
    if (next.playerDied) continue;
    const k = keyOf(next);
    if (seen.has(k)) continue;
    seen.add(k);
    q.push({ seq: [...f.seq, d], runner: next });
  }
}
if (found) {
  console.log("BFS OK", encodeSolutionMoves(found).join(""), "len", found.length);
  console.log(run(encodeSolutionMoves(found).join("")));
} else console.log("BFS fail", qi);
