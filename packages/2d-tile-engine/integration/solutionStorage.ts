import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const integrationDir = path.dirname(fileURLToPath(import.meta.url));
export const root = path.join(integrationDir, "..");
export const solutionsDir = path.join(integrationDir, "data/cc1-ms-solutions");
export const indexPath = path.join(solutionsDir, "index.json");

export interface SolutionIndexDoc {
  schemaVersion: number;
  description: string;
  sourceTemplate: string;
  levels: number[];
}

export function levelSolutionPath(levelNumber: number): string {
  return path.join(solutionsDir, `level-${String(levelNumber).padStart(3, "0")}.json`);
}

export function readIndex(): SolutionIndexDoc {
  return JSON.parse(fs.readFileSync(indexPath, "utf8")) as SolutionIndexDoc;
}

export function readLevelSolution<T = Record<string, unknown>>(levelNumber: number): T | null {
  const file = levelSolutionPath(levelNumber);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeLevelSolution(levelNumber: number, entry: unknown): void {
  fs.mkdirSync(solutionsDir, { recursive: true });
  fs.writeFileSync(levelSolutionPath(levelNumber), `${JSON.stringify(entry, null, 2)}\n`);
}

export function listLevelNumbers(index = readIndex()): number[] {
  return [...index.levels].sort((a, b) => a - b);
}
