#!/usr/bin/env node
/** Copy per-level CC1 solutions into the chips-challenge-web game pack. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  indexPath,
  levelSolutionPath,
  listLevelNumbers,
  readIndex,
  solutionsDir,
  toWebLevelEntry,
} from "./solutionStorage.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(indexPath, path.join(destDir, "index.json"));

for (const levelNumber of listLevelNumbers(readIndex())) {
  const src = levelSolutionPath(levelNumber);
  const entry = JSON.parse(fs.readFileSync(src, "utf8"));
  fs.writeFileSync(
    path.join(destDir, path.basename(src)),
    `${JSON.stringify(toWebLevelEntry(entry), null, 2)}\n`,
  );
}

console.log(`Copied ${solutionsDir} -> ${destDir} (web copies omit twsRecords)`);
