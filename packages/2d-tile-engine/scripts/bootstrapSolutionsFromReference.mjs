#!/usr/bin/env node
/**
 * Seed per-level CC1 solutions from original-level-reference.json (all 149 levels).
 * Preserves existing level files. Run before sync:bitbusters to refresh bold times online.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  listLevelNumbers,
  readIndex,
  readLevelSolution,
  writeIndex,
  writeLevelSolution,
} from "./solutionStorage.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const refPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/original-level-reference.json",
);

const ref = JSON.parse(fs.readFileSync(refPath, "utf8"));
const index = fs.existsSync(path.join(root, "integration/data/cc1-ms-solutions/index.json"))
  ? readIndex()
  : {
      schemaVersion: 2,
      description:
        "CC1 MS solution index. Per-level data in level-NNN.json; verified moves stored as U/D/L/R letters.",
      sourceTemplate: "https://scores.bitbusters.club/levels/cc1/{levelNumber}/ms",
      levels: [],
    };

const levelNumbers = [];
for (const level of ref.levels) {
  const levelNumber = level.number;
  levelNumbers.push(levelNumber);
  const existing = readLevelSolution(levelNumber) ?? {};
  const timeLimitSeconds = level.timeLimitSeconds ?? null;
  const boldTimeRemaining = level.boldTargetMs ?? null;
  const minChipMoves =
    timeLimitSeconds != null && boldTimeRemaining != null
      ? timeLimitSeconds - boldTimeRemaining
      : null;

  writeLevelSolution(levelNumber, {
    ...existing,
    levelId: existing.levelId ?? `level-${String(levelNumber).padStart(3, "0")}`,
    passwordMs: level.passwordMs,
    title: level.title,
    timeLimitSeconds,
    boldTimeRemaining,
    minChipMoves,
    moves: existing.moves ?? null,
    source:
      existing.source ?? `https://scores.bitbusters.club/levels/cc1/${levelNumber}/ms`,
  });
}

writeIndex({
  ...index,
  levels: [...new Set([...index.levels, ...levelNumbers])].sort((a, b) => a - b),
});
console.log(`Seeded ${levelNumbers.length} levels (${listLevelNumbers().length} indexed)`);
