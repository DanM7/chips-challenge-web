/**
 * Hypothesize which wall cells wrongly seal Chip, then try TWS / StrategyWiki routes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile, setUpperTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const levelPath =
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json";

function load() {
  const level = JSON.parse(readFileSync(levelPath, "utf8"));
  normalizeLevelLayers(level);
  return level;
}

function openCells(level, cells) {
  for (const [x, y] of cells) {
    if (cellTile(level, "upper", x, y) === "wall") {
      setUpperTile(level, x, y, "empty");
    }
  }
}

function runLetters(level, letters) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  const dirs = [];
  for (const ch of letters.replace(/\s/g, "")) {
    if (ch === "W") {
      stepMsCc1Wait(r);
      dirs.push("wait");
      continue;
    }
    const map = { U: "up", D: "down", L: "left", R: "right" };
    const d = map[ch];
    if (!d) continue;
    const bx = r.gx,
      by = r.gy;
    stepMsCc1Simulation(r, d);
    dirs.push(d);
    if (r.gx === bx && r.gy === by && !r.completed) {
      // move failed (position unchanged) — still counted in chipMoves by stepMsCc1Simulation
    }
    if (r.playerDied || r.completed) break;
  }
  return {
    completed: r.completed,
    died: r.playerDied,
    pos: `${r.gx},${r.gy}`,
    flippers: !!r.playerState.hasFlippers || r.playerState.tools?.includes?.("flippers"),
    tools: r.playerState.tools,
    rem: msSecondsRemaining(600, r.buttonPressCtx.moveBoundary),
    mb: r.buttonPressCtx.moveBoundary,
    moves: r.chipMoves,
    letters: encodeSolutionMoves(dirs),
  };
}

const hypotheses = {
  none: [],
  "open-4-29": [[4, 29]],
  "open-1-3-30": [
    [1, 30],
    [2, 30],
    [3, 30],
  ],
  "open-4-29-and-left": [
    [4, 29],
    [1, 30],
    [2, 30],
    [3, 30],
  ],
  "open-bottom-corridor": [
    [1, 30],
    [2, 30],
    [3, 30],
    [4, 29],
  ],
};

const sol = readLevelSolution(18);
const twsMoves = replayTwsRecords(load(), sol.twsRecords).chipMoves;
const twsLetters = encodeSolutionMoves(twsMoves).join("");
console.log("TWS letter len", twsLetters.length, "prefix", twsLetters.slice(0, 80));

for (const [name, cells] of Object.entries(hypotheses)) {
  const level = load();
  openCells(level, cells);
  // TWS replay
  const r = createMsCc1SimulationRunner(structuredClone(level));
  let i = 0;
  for (const d of twsMoves) {
    stepMsCc1Simulation(r, d);
    i++;
    if (r.completed || r.playerDied) break;
  }
  console.log(
    `TWS @ ${name}: done=${r.completed} died=${r.playerDied} pos=${r.gx},${r.gy} fl=${r.playerState.tools} rem=${msSecondsRemaining(600, r.buttonPressCtx.moveBoundary)} after ${i}/${twsMoves.length}`,
  );
}

// Manual StrategyWiki-ish exploration with open-1-3-30
{
  const level = load();
  openCells(level, hypotheses["open-1-3-30"]);
  // From start: go left along bottom, up into left path
  const prefix = "LLLU"; // 5,30 -> 4,30 -> 3,30 -> 2,30 -> 2,29?
  // Actually LLL from 5: 4,3,2 then U to 2,28 or 2,29
  console.log("\nManual prefixes with open-1-3-30:");
  for (const p of [
    "LLL",
    "LLLU",
    "LLLL",
    "LLLLU",
    "LLLUU",
    "LLLUL",
    "LLLUUUUUUUUUUUUUUUUUUUUUUUU",
  ]) {
    console.log(p.length, p.slice(0, 12), runLetters(level, p));
  }
}

// With open-4-29: L then U
{
  const level = load();
  openCells(level, hypotheses["open-4-29"]);
  console.log("\nManual with open-4-29:");
  for (const p of ["L", "LU", "LUU", "LUUU", "LUUUL", "UL", "U"]) {
    console.log(p, runLetters(level, p));
  }
}
