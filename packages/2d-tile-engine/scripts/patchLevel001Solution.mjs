#!/usr/bin/env node
/** Patch level 1 with engine-verified BFS route (replaces TWS tape for auto-play). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encodeSolutionMoves } from "./solutionMoves.mjs";
import { readLevelSolution, writeLevelSolution } from "./solutionStorage.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const moves = JSON.parse(
  fs.readFileSync(path.join(scriptsDir, "level001-solution.json"), "utf8"),
);
const existing = readLevelSolution(1);
if (!existing) {
  console.error("No solutions entry for level 1");
  process.exit(1);
}

writeLevelSolution(1, {
  ...existing,
  moves: encodeSolutionMoves(moves),
  moveVerified: true,
  meetsBoldBudget: false,
  moveSource:
    "engine BFS (sim-verified); TWS reference in twsMoves (does not complete in sim)",
});

console.log(`Patched level 1: ${moves.length} moves, moveVerified=true`);
