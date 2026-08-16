import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirMap: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};

function run(letters: string) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  const moves: Direction[] = [];
  for (const ch of letters) {
    if (ch === " " || ch === ",") continue;
    const d = dirMap[ch];
    if (!d) throw new Error(`bad ${ch}`);
    moves.push(d);
    const before = { x: runner.gx, y: runner.gy };
    stepMsCc1Simulation(runner, d);
    if (runner.gx === before.x && runner.gy === before.y && !runner.completed) {
      return {
        ok: false,
        stuckAt: moves.length - 1,
        pos: before,
        chips: runner.playerState.chipsRemainingOnMap,
        keys: runner.playerState.keys,
        letters,
      };
    }
    if (runner.completed || runner.playerDied) break;
  }
  return {
    ok: runner.completed,
    died: runner.playerDied,
    pos: { x: runner.gx, y: runner.gy },
    chips: runner.playerState.chipsRemainingOnMap,
    keys: runner.playerState.keys,
    ticks: runner.buttonPressCtx.moveBoundary,
    remaining: msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary),
    moves: encodeSolutionMoves(moves.slice(0, runner.chipMoves)),
    moveCount: runner.chipMoves,
  };
}

/**
 * Manual counterclockwise bold attempt from map + StrategyWiki opener.
 *
 * Map rooms (see dump):
 *   NW alcove via blue door (12,12): Y(10,12) *(10,13)
 *   SW via red door (12,16): *(10,15)
 *   Bottom via yellow doors: G(16,20) *(14,19)*(16,19)
 *   SE via blue door (18,16): *(20,15)
 *   NE via red door (18,12): Y(20,12) *(20,13) *(18,10)
 *   Top green doors to *(12,10) and exit
 */
const candidates: Array<{ name: string; route: string }> = [
  {
    name: "ccw-v1",
    // opener into NW, yellow+chip, back, down for blue key, open yellow south,
    // green key + bottom chips, up east side, red keys, NE chips, green doors, exit
    route:
      "LLUUL" + // blue door
      "LLD" + // Y + chip NW
      "URRR" + // back to (13,12)
      "DD" + // blue key (13,15)
      "RDDR" + // wait - need careful
      "",
  },
];

// Build carefully with incremental verification
function tryExtend(base: string, add: string): string | null {
  const r = run(base + add);
  if ((r as { ok: boolean }).ok === false && "stuckAt" in r) {
    console.log("stuck", base + add, r);
    return null;
  }
  console.log("ok", base.length + add.length, r);
  return base + add;
}

let route = "LLUUL"; // at (12,12)
console.log("start", run(route));

// NW yellow + chip
route = tryExtend(route, "LLD") ?? route; // (10,13)
// back toward center via (13,12)
route = tryExtend(route, "URRR") ?? route; // (13,12)
// get lower blue key
route = tryExtend(route, "DDD") ?? route; // (13,15) B then (13,16)?
console.log("pos check", run(route));

// From wherever we are, explore a hand-built full route string
const fullAttempts = [
  // Attempt A: classic-ish CCW
  "LLUULLLDURRRDDDRDDDU" + // partial from TWS start that worked
    "RRRRR" + // toward east - may fail
    "",
  // Attempt B: after NW, get center chip, blue key, yellow door south, green, bottom, etc.
  "LLUUL" + // (12,12)
    "LLD" + // (10,13) Y+*
    "U" + // (10,12)
    "RRR" + // (13,12)
    "DD" + // (13,14)-(13,15) B
    "R" + // (14,15)
    "D" + // (14,16)
    "D" + // (14,17) open y
    "D" + // (14,18)
    "D" + // (14,19) *
    "R" + // (15,19)
    "R" + // (16,19) *
    "D" + // (16,20) G
    "U" + // (16,19)
    "U" + // (16,18)
    "U" + // (16,17) open other y? already have path
    "U" + // (16,16)
    "R" + // (17,16)
    "R" + // (18,16) open b with blue
    "R" + // (19,16)
    "R" + // (20,16)
    "U" + // (20,15) *
    "U" + // (20,14)
    "U" + // (20,13) *
    "U" + // (20,12) Y
    "L" + // (19,12)
    "L" + // (18,12) open r
    "L" + // (17,12)
    "U" + // (17,11)? wall
    "",
];

for (const letters of fullAttempts) {
  if (!letters) continue;
  const r = run(letters);
  console.log("\nATTEMPT", letters.slice(0, 40) + "...", "\n", r);
  if (r.ok && typeof r.remaining === "number" && r.remaining >= 83) {
    writeFileSync(
      path.join(root, ".tmp/level001-bold-solution.json"),
      JSON.stringify(
        {
          levelId: "level-001",
          passwordMs: "BDHP",
          title: "Lesson 1",
          timeLimitSeconds: 100,
          boldTimeRemaining: 83,
          minChipMoves: 17,
          moves: r.moves,
          source: "https://scores.bitbusters.club/levels/cc1/1/ms",
          walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
          moveVerified: true,
          meetsBoldBudget: true,
          moveSource: `manual CCW from StrategyWiki opener; ${r.remaining}s remaining`,
          simulatedTicks: r.ticks,
          simulatedSecondsRemaining: r.remaining,
        },
        null,
        2,
      ),
    );
    break;
  }
}
