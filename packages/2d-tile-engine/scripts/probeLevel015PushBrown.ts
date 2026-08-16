/**
 * Probe pushing block onto brown from insert point.
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
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
  return "gone";
}

function run(seq: string) {
  const r = cloneMsCc1SimulationRunner(r0);
  const moves = decodeSolutionMoves([...seq]) as Direction[];
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) break;
  }
  return {
    seq,
    pos: { x: r.gx, y: r.gy },
    block: blockPos(r),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    blue: cellTile(r.level, "upper", 16, 11),
    socket: cellTile(r.level, "upper", 16, 10),
    keys: r.playerState.keys,
    died: r.playerDied,
    death: r.deathMessage,
  };
}

// Step-by-step carefully:
// 1) Open blue door: from (19,13) go to (16,11)
console.log(run("LLLUU")); // should open blue at (16,11)
console.log(run("LLLUUL")); // 
console.log(run("LLLUULD"));
// 2) Get to east of block and push
// After LLLUU at (16,11), door open. Block still (18,13).
// Go to (19,13): DDRRR or similar, push L L
console.log(run("LLLUUDDRRRLL"));
console.log(run("LLLUUDDRRRLLDLUUUU"));
console.log(run("LLLUUDDRRRLLDLUUU"));
console.log(run("LLLUUDDRRRLLULUUUU"));

// BFS with better key
const dirs: Direction[] = ["up", "down", "left", "right"];
type Frame = { seq: Direction[]; runner: Runner };
const q: Frame[] = [{ seq: [], runner: r0 }];
const seen = new Set<string>();
const keyOf = (x: Runner) => `${x.gx},${x.gy}|${blockPos(x)}|${x.playerState.keys.join("+")}|${cellTile(x.level, "upper", 16, 11)}`;
seen.add(keyOf(r0));
let qi = 0;
let found: Direction[] | null = null;
while (qi < q.length && qi < 1_000_000) {
  const f = q[qi++]!;
  if (blockPos(f.runner) === "16,9") {
    found = f.seq;
    console.log("FOUND", encodeSolutionMoves(found).join(""), "nodes", qi);
    break;
  }
  if (f.seq.length >= 40 || f.runner.playerDied) continue;
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
if (!found) console.log("BFS fail nodes", qi, "seen", seen.size);
else console.log(run(encodeSolutionMoves(found).join("")));
