#!/usr/bin/env node
/** Convert spelled-out directions in per-level solution files to U/D/L/R letters. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encodeSolutionMoves } from "./solutionMoves.mjs";
import { listLevelNumbers, readIndex, readLevelSolution, writeLevelSolution } from "./solutionStorage.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
let converted = 0;
let moveCount = 0;

for (const levelNumber of listLevelNumbers(readIndex())) {
  const entry = readLevelSolution(levelNumber);
  if (!Array.isArray(entry?.moves) || entry.moves.length === 0) {
    continue;
  }
  const first = entry.moves[0];
  if (first === "up" || first === "down" || first === "left" || first === "right") {
    moveCount += entry.moves.length;
    writeLevelSolution(levelNumber, {
      ...entry,
      moves: encodeSolutionMoves(entry.moves),
    });
    converted += 1;
  }
}

console.log(`Converted ${converted} levels (${moveCount} moves)`);

for (const file of fs.readdirSync(scriptsDir)) {
  const match = /^level(\d{3})-solution\.json$/.exec(file);
  if (!match) continue;
  const filePath = path.join(scriptsDir, file);
  const moves = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(moves) || moves.length === 0) continue;
  const first = moves[0];
  if (first === "up" || first === "down" || first === "left" || first === "right") {
    fs.writeFileSync(filePath, `${JSON.stringify(encodeSolutionMoves(moves))}\n`);
    console.log(`Converted ${file}`);
  }
}
