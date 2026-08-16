#!/usr/bin/env node
/** Patch level N from levelNNN-solution.json into per-level solution storage. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encodeSolutionMoves } from "./solutionMoves.mjs";
import { readLevelSolution, writeLevelSolution } from "./solutionStorage.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const levelNum = process.argv[2];
if (!levelNum) {
  console.error("Usage: node scripts/patchLevelSolution.mjs <levelNumber>");
  process.exit(1);
}

const solutionFile = path.join(scriptsDir, `level${String(levelNum).padStart(3, "0")}-solution.json`);
if (!fs.existsSync(solutionFile)) {
  console.error("Missing", solutionFile);
  process.exit(1);
}

const moves = JSON.parse(fs.readFileSync(solutionFile, "utf8"));
const existing = readLevelSolution(Number.parseInt(levelNum, 10));
if (!existing) {
  console.error(`No solutions entry for level ${levelNum}`);
  process.exit(1);
}

writeLevelSolution(Number.parseInt(levelNum, 10), {
  ...existing,
  moves: encodeSolutionMoves(moves),
  moveVerified: true,
  meetsBoldBudget: false,
  moveSource:
    "engine BFS shortest (sim-verified); TWS reference in twsMoves (does not complete in sim)",
});

console.log(`Patched level ${levelNum}: ${moves.length} moves, moveVerified=true`);
