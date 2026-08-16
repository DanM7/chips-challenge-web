/**
 * Guided Castle Moat exploration with in-memory (4,29) patch.
 * Walk path, push blocks per StrategyWiki, swim to exit.
 */
import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile, setUpperTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const levelPath =
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json";

function loadPatched(): LevelData {
  const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  if (cellTile(level, "upper", 4, 29) === "wall") setUpperTile(level, 4, 29, "empty");
  return level;
}

const DIR: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };

function run(letters: string, verbose = false) {
  const level = loadPatched();
  const r = createMsCc1SimulationRunner(structuredClone(level));
  const dirs: Direction[] = [];
  for (const ch of letters.replace(/\s/g, "")) {
    const d = DIR[ch];
    if (!d) continue;
    const bx = r.gx,
      by = r.gy;
    stepMsCc1Simulation(r, d);
    dirs.push(d);
    if (verbose) {
      console.log(
        ch,
        `${bx},${by}->${r.gx},${r.gy}`,
        getCompositeTile(r.level, r.gx, r.gy),
        r.playerState.tools.join(",") || "-",
        "block28,1=",
        getCompositeTile(r.level, 28, 1),
        "block26,5=",
        getCompositeTile(r.level, 26, 5),
      );
    }
    if (r.playerDied || r.completed) break;
  }
  return {
    completed: r.completed,
    died: r.playerDied,
    msg: r.deathMessage,
    pos: `${r.gx},${r.gy}`,
    tools: r.playerState.tools,
    rem: msSecondsRemaining(600, r.buttonPressCtx.moveBoundary),
    mb: r.buttonPressCtx.moveBoundary,
    moves: dirs.length,
    letters: encodeSolutionMoves(dirs).join(""),
    b281: getCompositeTile(r.level, 28, 1),
    b265: getCompositeTile(r.level, 26, 5),
    lower281: cellTile(r.level, "lower", 28, 1),
  };
}

// Map path from start through left maze toward NE
function dumpReachableSketch(letters: string) {
  const level = loadPatched();
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters.replace(/\s/g, "")) {
    const d = DIR[ch];
    if (d) stepMsCc1Simulation(r, d);
  }
  console.log("at", r.gx, r.gy, "tools", r.playerState.tools);
  for (let y = Math.max(0, r.gy - 4); y <= Math.min(31, r.gy + 4); y++) {
    let row = "";
    for (let x = Math.max(0, r.gx - 6); x <= Math.min(31, r.gx + 10); x++) {
      if (x === r.gx && y === r.gy) row += "C";
      else {
        const t = getCompositeTile(r.level, x, y);
        row +=
          t === "wall"
            ? "#"
            : t === "block_movable"
              ? "B"
              : t === "water"
                ? "~"
                : t === "flippers"
                  ? "F"
                  : t === "exit"
                    ? "E"
                    : t === "fire"
                      ? "*"
                      : t.startsWith("block")
                        ? "b"
                        : " ";
      }
    }
    console.log(String(y).padStart(2), row);
  }
}

// Exit alcove then explore toward blocks
const exitAlcove = "LU"; // 5,30 -> 4,30 -> 4,29
console.log("exit alcove", run(exitAlcove));

// From (4,29) continue into maze - try path finding greedily toward (26,5)
// Print local map after walking into block area via left then east/north alternating

// Known layout: left corridor up, then weave to NE
// Try: LU then go up the left channel
const routes = [
  // left spine up then east toward (26,5)
  "LUUU",
  "LUUUL",
  "LUUUU",
  "LUUUULUUUU",
  // After open: from 4,28 go left around?
  "LUL",
  "LULL",
  "LULLU",
];

for (const route of routes) {
  console.log(route, run(route));
}

console.log("\n--- sketch after LUUUL ---");
dumpReachableSketch("LUUUL");

console.log("\n--- sketch after longer left climb ---");
// Climb left side
dumpReachableSketch("LU" + "U".repeat(20));
