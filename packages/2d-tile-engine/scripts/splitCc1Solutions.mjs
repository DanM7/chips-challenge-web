#!/usr/bin/env node
/**
 * Split cc1-ms-solutions.json into integration/data/cc1-ms-solutions/level-NNN.json
 * plus a lightweight index.json.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TO_DIRECTION } from "./solutionMoves.mjs";
import {
  indexPath,
  legacyMonolithPath,
  listLevelNumbers,
  readIndex,
  solutionsDir,
  writeIndex,
  writeLevelSolution,
} from "./solutionStorage.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));

function isValidMoves(moves) {
  return (
    Array.isArray(moves) &&
    moves.length > 0 &&
    moves.every((move) => move != null && TO_DIRECTION[move])
  );
}

function loadVerifiedMovesFromScript(levelNumber) {
  const file = path.join(scriptsDir, `level${String(levelNumber).padStart(3, "0")}-solution.json`);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function loadMonolith() {
  if (!fs.existsSync(legacyMonolithPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(legacyMonolithPath, "utf8"));
  } catch (error) {
    console.warn(`Could not parse legacy monolith: ${error.message}`);
    return null;
  }
}

function buildFromMonolith(doc) {
  fs.mkdirSync(solutionsDir, { recursive: true });
  const levelNumbers = Object.keys(doc.levels)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  for (const levelNumber of levelNumbers) {
    const key = String(levelNumber);
    const entry = { ...doc.levels[key] };
    if (entry.moveVerified === true && !isValidMoves(entry.moves)) {
      const restored = loadVerifiedMovesFromScript(levelNumber);
      if (restored) {
        entry.moves = restored;
        console.log(`Restored verified moves for level ${levelNumber} from scripts/`);
      }
    }
    writeLevelSolution(levelNumber, entry);
  }

  writeIndex({
    schemaVersion: 2,
    description:
      "CC1 MS solution index. Per-level data in level-NNN.json; verified moves stored as U/D/L/R letters.",
    sourceTemplate: doc.sourceTemplate,
    levels: levelNumbers,
  });

  console.log(`Split ${levelNumbers.length} levels into ${solutionsDir}`);
}

function rebuildIndexFromFiles() {
  const levelNumbers = fs
    .readdirSync(solutionsDir)
    .map((name) => /^level-(\d{3})\.json$/.exec(name))
    .filter(Boolean)
    .map((match) => Number.parseInt(match[1], 10))
    .sort((a, b) => a - b);

  writeIndex({
    schemaVersion: 2,
    description:
      "CC1 MS solution index. Per-level data in level-NNN.json; verified moves stored as U/D/L/R letters.",
    sourceTemplate: "https://scores.bitbusters.club/levels/cc1/{levelNumber}/ms",
    levels: levelNumbers,
  });
  console.log(`Indexed ${levelNumbers.length} level files in ${indexPath}`);
}

const monolith = loadMonolith();
if (monolith?.levels) {
  buildFromMonolith(monolith);
} else if (fs.existsSync(solutionsDir)) {
  rebuildIndexFromFiles();
} else {
  console.error("No legacy monolith or existing per-level directory to split.");
  process.exit(1);
}

if (process.argv.includes("--remove-monolith") && fs.existsSync(legacyMonolithPath)) {
  fs.unlinkSync(legacyMonolithPath);
  console.log(`Removed legacy ${legacyMonolithPath}`);
}

console.log(`Levels indexed: ${listLevelNumbers(readIndex()).join(", ").slice(0, 80)}...`);
