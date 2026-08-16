#!/usr/bin/env node
/** Clear `moves` on levels where moveVerified !== true (reference data lives in twsRecords). */
import { listLevelNumbers, readIndex, readLevelSolution, writeLevelSolution } from "./solutionStorage.mjs";

let cleared = 0;
for (const levelNumber of listLevelNumbers(readIndex())) {
  const entry = readLevelSolution(levelNumber);
  if (!entry || entry.moveVerified === true || !entry.moves?.length) {
    continue;
  }
  writeLevelSolution(levelNumber, { ...entry, moves: null });
  cleared += 1;
}
console.log(`Cleared moves on ${cleared} unverified levels`);
