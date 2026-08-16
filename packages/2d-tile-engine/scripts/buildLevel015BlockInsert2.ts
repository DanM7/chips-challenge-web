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
const TIME_LIMIT = 250;
const BOLD = 89;

function blockPos(r: Runner): string {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "gone";
}

function apply(r: Runner, seq: Direction[]) {
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
}

const r0 = createMsCc1SimulationRunner(structuredClone(level));
apply(r0, tws.slice(0, 445));

function test(seq: string) {
  const r = cloneMsCc1SimulationRunner(r0);
  apply(r, decodeSolutionMoves([...seq]) as Direction[]);
  const ok = blockPos(r) === "16,9" && isTrapOpen(r.buttonPressCtx, 16, 16) && !r.playerDied;
  console.log(ok ? "OK" : "  ", {
    seq,
    pos: `${r.gx},${r.gy}`,
    block: blockPos(r),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    blue: cellTile(r.level, "upper", 16, 11),
    died: r.playerDied,
    death: r.deathMessage,
    ticks: r.buttonPressCtx.moveBoundary,
  });
  return ok ? r : null;
}

const pushSeqs = [
  "LLDLURUULRDDLUUU",
  "LLDLURUULRDDLUU",
  "LLDLURUULRDDLUUUU",
  "LLDLU RUUL RDDL UUU".replace(/ /g, ""),
  "LL D L U R U U L R D D L U U U".replace(/ /g, ""),
];

let push: Direction[] | null = null;
let afterPush: Runner | null = null;
for (const s of pushSeqs) {
  const r = test(s);
  if (r) {
    push = decodeSolutionMoves([...s]) as Direction[];
    afterPush = r;
    break;
  }
}

if (!push || !afterPush) {
  console.error("no push");
  process.exit(1);
}

// Continue TWS 445..793 then short exit
const mid = tws.slice(445, 793);
const afterSlide = cloneMsCc1SimulationRunner(afterPush);
apply(afterSlide, mid);
console.log("after slide", {
  pos: `${afterSlide.gx},${afterSlide.gy}`,
  ticks: afterSlide.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, afterSlide.buttonPressCtx.moveBoundary),
  trap: isTrapOpen(afterSlide.buttonPressCtx, 16, 16),
  blue: cellTile(afterSlide.level, "upper", 16, 11),
  chips: afterSlide.playerState.chipsRemainingOnMap,
  keys: afterSlide.playerState.keys,
  died: afterSlide.playerDied,
  death: afterSlide.deathMessage,
});

if (afterSlide.playerDied) {
  console.error("mid route died — TWS conflicts with moved block");
  process.exit(1);
}

for (const s of ["DRRUDDDDDDD", "DRRUUDDDDDDD", "DRRUDDDDDDDD", "DRRUUDDDDDDDD", "DDRRUDDDDDDD"]) {
  const r = cloneMsCc1SimulationRunner(afterSlide);
  apply(r, decodeSolutionMoves([...s]) as Direction[]);
  const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
  console.log("exit", s, {
    done: r.completed,
    died: r.playerDied,
    rem,
    ticks: r.buttonPressCtx.moveBoundary,
    pos: `${r.gx},${r.gy}`,
  });
  if (r.completed && !r.playerDied) {
    const full = [...tws.slice(0, 445), ...push, ...mid, ...(decodeSolutionMoves([...s]) as Direction[])];
    const v = createMsCc1SimulationRunner(structuredClone(level));
    apply(v, full);
    const vrem = msSecondsRemaining(TIME_LIMIT, v.buttonPressCtx.moveBoundary);
    console.log("VERIFY", { rem: vrem, ticks: v.buttonPressCtx.moveBoundary, exact: vrem === BOLD });
    writeFileSync(
      path.join(root, ".tmp/level015-bold-letters.json"),
      JSON.stringify(
        {
          letters: encodeSolutionMoves(full),
          rem: vrem,
          ticks: v.buttonPressCtx.moveBoundary,
          exact: vrem === BOLD,
          push: encodeSolutionMoves(push),
          exit: s,
        },
        null,
        2,
      ),
    );
    if (vrem >= BOLD) break;
  }
}
