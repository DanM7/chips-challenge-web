#!/usr/bin/env node
/**
 * Merge cc1-ms-tws-records.json into per-level solution files for a level range.
 * Preserves moveVerified routes on levels 1–4.
 *
 * Usage: node scripts/importTwsRecords.mjs [startLevel] [endLevel]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encodeSolutionMoves } from "./solutionMoves.mjs";
import { readLevelSolution, writeLevelSolution } from "./solutionStorage.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const recordsPath = path.join(root, "integration/data/cc1-ms-tws-records.json");
const startLevel = Number.parseInt(process.argv[2] ?? "5", 10);
const endLevel = Number.parseInt(process.argv[3] ?? "149", 10);

if (!fs.existsSync(recordsPath)) {
  console.error(`Missing ${recordsPath} — run exportCc1MsTwsRecords.py first.`);
  process.exit(1);
}

const recordsDoc = JSON.parse(fs.readFileSync(recordsPath, "utf8"));
const byLevel = new Map(recordsDoc.solutions.map((s) => [s.number, s]));

let imported = 0;
for (let n = startLevel; n <= endLevel; n += 1) {
  const rec = byLevel.get(n);
  const existing = readLevelSolution(n);
  if (!rec || !existing) {
    continue;
  }
  const keepVerified = existing.moveVerified === true;

  writeLevelSolution(n, {
    ...existing,
    twsRecords: rec.moves,
    twsRecordSource: recordsDoc.source,
    moves: keepVerified ? existing.moves : null,
    moveSource: keepVerified
      ? existing.moveSource
      : `CC1-ms TWS records (${rec.password}); pending engine verify`,
    moveVerified: keepVerified ? true : false,
  });

  imported += 1;
}

console.log(`Imported twsRecords for levels ${startLevel}–${endLevel} (${imported} updated)`);
