/** Paths and I/O for per-level CC1 solution files. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(scriptsDir, "..");
export const solutionsDir = path.join(root, "integration/data/cc1-ms-solutions");
export const indexPath = path.join(solutionsDir, "index.json");
export const legacyMonolithPath = path.join(root, "integration/data/cc1-ms-solutions.json");

export function levelSolutionPath(levelNumber) {
  return path.join(
    solutionsDir,
    `level-${String(levelNumber).padStart(3, "0")}.json`,
  );
}

export function readIndex() {
  return JSON.parse(fs.readFileSync(indexPath, "utf8"));
}

export function writeIndex(doc) {
  fs.mkdirSync(solutionsDir, { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(doc, null, 2)}\n`);
}

export function readLevelSolution(levelNumber) {
  const file = levelSolutionPath(levelNumber);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeLevelSolution(levelNumber, entry) {
  fs.mkdirSync(solutionsDir, { recursive: true });
  fs.writeFileSync(levelSolutionPath(levelNumber), `${JSON.stringify(entry, null, 2)}\n`);
}

export function listLevelNumbers(index = readIndex()) {
  return [...index.levels].sort((a, b) => a - b);
}

export function readAllLevelSolutions(index = readIndex()) {
  return listLevelNumbers(index).map((levelNumber) => ({
    levelNumber,
    entry: readLevelSolution(levelNumber),
  }));
}

/** Strip heavy TWS tick data from web-facing copies. */
export function toWebLevelEntry(entry) {
  const { twsRecords, twsRecordSource, ...rest } = entry;
  return rest;
}
