#!/usr/bin/env node
/**
 * Import pieguy / Tile World TWS move strings into per-level solution files.
 *
 * Usage:
 *   node scripts/importTwsSolutions.mjs [endLevel] [goldenJsonPath]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
import { encodeSolutionMoves } from "./solutionMoves.mjs";
import { readLevelSolution, writeLevelSolution } from "./solutionStorage.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultGolden = path.join(root, ".tmp/tws2json/tests/intro-ms.dac.json.golden");
const endLevel = Number.parseInt(process.argv[2] ?? "149", 10);
const goldenPath = path.resolve(process.argv[3] ?? defaultGolden);

if (!fs.existsSync(goldenPath)) {
  console.error(`Golden TWS JSON not found: ${goldenPath}`);
  process.exit(1);
}

const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));

let imported = 0;
for (const entry of golden.solutions ?? []) {
  if (entry.number > endLevel) {
    continue;
  }
  const existing = readLevelSolution(entry.number);
  if (!existing) {
    continue;
  }
  const parsed = parseCcMoveStringMs(entry.moves);
  writeLevelSolution(entry.number, {
    ...existing,
    twsMoves: entry.moves,
    moves: encodeSolutionMoves(parsed),
    moveSource: `pieguy TWS (${entry.password})`,
    moveVerified: false,
  });
  imported += 1;
  console.log(`Level ${entry.number}: ${parsed.length} MS moves (${entry.password})`);
}

console.log(`Updated ${imported} level(s)`);
