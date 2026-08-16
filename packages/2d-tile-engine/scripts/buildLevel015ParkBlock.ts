/**
 * Park block at (16,13) mid-route; after slide, push onto brown + exit → rem 89.
 */
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

const insertAt = 445;
const r0 = createMsCc1SimulationRunner(structuredClone(level));
apply(r0, tws.slice(0, insertAt));

// Open door, approach from east, push LL to park at (16,13)
const parkStr = "ULLLUDDDRRRULL";
const afterPark = cloneMsCc1SimulationRunner(r0);
apply(afterPark, decodeSolutionMoves([...parkStr]) as Direction[]);
console.log("parked", {
  pos: `${afterPark.gx},${afterPark.gy}`,
  block: blockPos(afterPark),
  blue: cellTile(afterPark.level, "upper", 16, 11),
  ticks: afterPark.buttonPressCtx.moveBoundary,
  died: afterPark.playerDied,
});

if (blockPos(afterPark) !== "16,13") {
  console.error("park failed");
  process.exit(1);
}

const park = decodeSolutionMoves([...parkStr]) as Direction[];
const mid = tws.slice(insertAt, 793);
const afterSlide = cloneMsCc1SimulationRunner(afterPark);
apply(afterSlide, mid);
console.log("after slide", {
  pos: `${afterSlide.gx},${afterSlide.gy}`,
  ticks: afterSlide.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(TIME_LIMIT, afterSlide.buttonPressCtx.moveBoundary),
  block: blockPos(afterSlide),
  chips: afterSlide.playerState.chipsRemainingOnMap,
  keys: afterSlide.playerState.keys,
  died: afterSlide.playerDied,
  death: afterSlide.deathMessage,
});

if (afterSlide.playerDied) {
  console.error("mid died");
  // find death point
  const t = cloneMsCc1SimulationRunner(afterPark);
  for (let i = 0; i < mid.length; i++) {
    stepMsCc1Simulation(t, mid[i]!);
    if (t.playerDied) {
      console.log("died at mid", i, mid[i], { x: t.gx, y: t.gy }, t.deathMessage);
      break;
    }
  }
  process.exit(1);
}

// From (14,11), block at (16,13): get south, push UUUU onto brown, go to exit
const exitVariants = [
  "DRRRDLUUUUDDDDDDDD", // to (16,14), push UUUU, then DDDDDDDD from brown
  "DRRRDLUUUUDDDDDDD",
  "DDRRRULUUUUDDDDDDDD",
  "DRRRDLLUUUUDDDDDDDD",
  "DRRRDLUUUU DDDDDDDD".replace(/ /g, ""),
  // shorter if already aligned
  "DRRDLUUUUDDDDDDDD",
];

for (const s of exitVariants) {
  const end = cloneMsCc1SimulationRunner(afterSlide);
  apply(end, decodeSolutionMoves([...s]) as Direction[]);
  const rem = msSecondsRemaining(TIME_LIMIT, end.buttonPressCtx.moveBoundary);
  console.log("exit", s, {
    done: end.completed,
    died: end.playerDied,
    death: end.deathMessage,
    rem,
    ticks: end.buttonPressCtx.moveBoundary,
    block: blockPos(end),
    trap: isTrapOpen(end.buttonPressCtx, 16, 16),
    pos: `${end.gx},${end.gy}`,
  });
  if (end.completed && !end.playerDied && rem >= BOLD) {
    const full = [
      ...tws.slice(0, insertAt),
      ...park,
      ...mid,
      ...(decodeSolutionMoves([...s]) as Direction[]),
    ];
    const v = createMsCc1SimulationRunner(structuredClone(level));
    apply(v, full);
    const vrem = msSecondsRemaining(TIME_LIMIT, v.buttonPressCtx.moveBoundary);
    console.log("VERIFY", {
      rem: vrem,
      ticks: v.buttonPressCtx.moveBoundary,
      exact: vrem === BOLD,
      moves: full.length,
    });
    writeFileSync(
      path.join(root, ".tmp/level015-bold-letters.json"),
      JSON.stringify(
        {
          letters: encodeSolutionMoves(full),
          rem: vrem,
          ticks: v.buttonPressCtx.moveBoundary,
          exact: vrem === BOLD,
          park: parkStr,
          exit: s,
        },
        null,
        2,
      ),
    );
    if (vrem === BOLD) console.log("SUCCESS exact bold 89");
    else if (vrem > BOLD) console.log("SUCCESS above bold", vrem);
    break;
  }
}
