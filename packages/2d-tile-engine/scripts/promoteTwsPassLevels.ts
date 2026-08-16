#!/usr/bin/env node
/**
 * Promote levels whose TWS record replay passes in engine sim to moveVerified autoplay routes.
 *
 * Usage: npx tsx scripts/promoteTwsPassLevels.ts [fromLevel] [toLevel]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import type { LevelData } from "../engine/types.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import {
  listLevelNumbers,
  readIndex,
  readLevelSolution,
  writeLevelSolution,
} from "../integration/solutionStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const webSolutionsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);

const fromLevel = Number.parseInt(process.argv[2] ?? "1", 10);
const toLevel = Number.parseInt(process.argv[3] ?? "149", 10);

function loadLevel(levelId: string): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, `${levelId}.json`), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function copyToWeb(levelNumber: number, entry: Record<string, unknown>): void {
  const { twsRecords, twsRecordSource, ...webEntry } = entry as Record<string, unknown> & {
    twsRecords?: unknown;
    twsRecordSource?: unknown;
  };
  fs.mkdirSync(webSolutionsDir, { recursive: true });
  fs.writeFileSync(
    path.join(webSolutionsDir, `level-${String(levelNumber).padStart(3, "0")}.json`),
    `${JSON.stringify(webEntry, null, 2)}\n`,
  );
}

let promoted = 0;
let failed = 0;
let skipped = 0;

for (const levelNumber of listLevelNumbers(readIndex())) {
  if (levelNumber < fromLevel || levelNumber > toLevel) {
    continue;
  }
  const entry = readLevelSolution<{
    levelId: string;
    moveVerified?: boolean;
    twsRecords?: { tick: number; direction: number }[];
    moveSource?: string;
  }>(levelNumber);
  if (!entry?.twsRecords?.length) {
    skipped += 1;
    continue;
  }
  if (entry.moveVerified === true) {
    skipped += 1;
    continue;
  }

  const level = loadLevel(entry.levelId);
  const replay = replayTwsRecords(structuredClone(level), entry.twsRecords);
  if (!replay.completed || replay.playerDied) {
    failed += 1;
    console.log(
      `  skip ${levelNumber}: ${replay.chipMoves.length} moves @ ${replay.finalPosition.x},${replay.finalPosition.y} ${replay.deathMessage ?? "stuck"}`,
    );
    continue;
  }

  const updated = {
    ...entry,
    moves: encodeSolutionMoves(replay.chipMoves),
    moveVerified: true,
    meetsBoldBudget: false,
    moveSource: `${entry.moveSource ?? "TWS records"}; promoted after engine TWS replay pass`,
  };
  writeLevelSolution(levelNumber, updated);
  copyToWeb(levelNumber, updated);
  promoted += 1;
  console.log(`  promote ${levelNumber}: ${replay.chipMoves.length} moves`);
}

console.log(`Done: ${promoted} promoted, ${failed} TWS fail, ${skipped} skipped`);
