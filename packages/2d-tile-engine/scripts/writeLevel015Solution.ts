import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
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
const TIME_LIMIT = 250;

function apply(r: Runner, letters: string[]) {
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (r.completed || r.playerDied) break;
  }
}

// --- Build rem-88 route (best complete) ---
const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const exit88 = [..."DRRUUUDDDDDDDD"];
const letters88 = [...encodeSolutionMoves(tws.slice(0, 793)), ...exit88];
const r88 = createMsCc1SimulationRunner(structuredClone(level));
apply(r88, letters88);
const rem88 = msSecondsRemaining(TIME_LIMIT, r88.buttonPressCtx.moveBoundary);
console.log("route88", {
  done: r88.completed,
  died: r88.playerDied,
  rem: rem88,
  ticks: r88.buttonPressCtx.moveBoundary,
  moves: letters88.length,
  waits: letters88.filter((c) => c === "W").length,
});

writeFileSync(
  path.join(root, ".tmp/level015-rem88.json"),
  JSON.stringify(
    {
      letters: letters88,
      rem: rem88,
      ticks: r88.buttonPressCtx.moveBoundary,
      completed: r88.completed,
    },
    null,
    2,
  ),
);

// --- Try ice skates from fire+key state ---
// Reconstruct blue_key+fire: load SW chips6 progress from a known good path
// Use letters from rem88's unrelated path - instead rebuild SW prefix from buildLevel015SwDeep progress

const swPartial = JSON.parse(
  readFileSync(path.join(root, ".tmp/l015-swdeep.txt"), "utf8").includes("chips6")
    ? path.join(root, ".tmp/level015-sw-chips6-backup.json")
    : path.join(root, ".tmp/level015-bold-letters.json"),
  "utf8",
) as { letters?: string[]; label?: string };

// Find chips6 letters: re-run SW openings + known segments from swdeep log is hard.
// Use current bold-letters if it has fire boots after applying fire seq from blue_key length.

const cur = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[]; label?: string };

console.log("current save", cur.label, cur.letters.length);

// Write web solution as rem88 for now (not bold)
const webPath =
  path.join(
    root,
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
  );

const entry = {
  levelId: "level-015",
  passwordMs: "COZQ",
  title: "Elementary",
  timeLimitSeconds: 250,
  boldTimeRemaining: 89,
  minChipMoves: 161,
  moves: letters88,
  source: "https://scores.bitbusters.club/levels/cc1/15/ms",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
  boldRouteHint:
    "SW flippers+blue; NW suction+red; water+force; fire boots+red; ice skates+blue; block L; fire W then E; ice E then S; ice thief slide; block L+socket; hold brown → exit. Engine best: TWS-to-force-thief-slide + chip-hold brown exit = 88 (bold 89 needs 2 more ticks).",
  moveVerified: r88.completed && !r88.playerDied,
  meetsBoldBudget: rem88 >= 89,
  moveSource: `TWS prefix through force-thief slide + StrategyWiki chip-hold brown exit; engine-verified ${rem88}s left (bold 89)`,
  simulatedTicks: r88.buttonPressCtx.moveBoundary,
  simulatedSecondsRemaining: rem88,
};

writeFileSync(webPath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
console.log("wrote", webPath, "rem", rem88, "meetsBold", rem88 >= 89);
