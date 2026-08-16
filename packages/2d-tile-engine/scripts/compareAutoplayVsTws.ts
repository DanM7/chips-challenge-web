#!/usr/bin/env node
/** Compare TWS replay vs fixed-wait autoplay for verified levels. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import type { LevelData } from "../engine/types.js";
import {
  simulateMsCc1AutoplayLevel,
  simulateMsCc1Level,
} from "../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { listLevelNumbers, readIndex, readLevelSolution } from "../integration/solutionStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelsDir = path.join(
  __dirname,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);

function loadLevel(levelId: string): LevelData {
  const level = JSON.parse(fs.readFileSync(path.join(levelsDir, `${levelId}.json`), "utf8")) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

let autoplayFail = 0;
let bareFail = 0;

for (const n of listLevelNumbers(readIndex())) {
  const entry = readLevelSolution<{
    levelId: string;
    moveVerified?: boolean;
    moves: string[] | null;
    twsRecords?: { tick: number; direction: number }[];
  }>(n);
  if (entry.moveVerified !== true || !entry.moves?.length || !entry.twsRecords?.length) continue;

  const level = loadLevel(entry.levelId);
  const moves = decodeSolutionMoves(entry.moves);
  const tws = replayTwsRecords(structuredClone(level), entry.twsRecords);
  const autoplay = simulateMsCc1AutoplayLevel(structuredClone(level), moves);
  const bare = simulateMsCc1Level(structuredClone(level), moves);

  if (!(tws.completed && !tws.playerDied)) {
    console.log(`level ${n}: tws unexpectedly fail`);
    continue;
  }
  if (!(autoplay.completed && !autoplay.playerDied)) {
    autoplayFail += 1;
    console.log(
      `level ${n}: autoplay FAIL @ ${autoplay.finalPosition.x},${autoplay.finalPosition.y} ${autoplay.deathMessage ?? "stuck"}`,
    );
  }
  if (!(bare.completed && !bare.playerDied)) {
    bareFail += 1;
    console.log(
      `level ${n}: bare moves FAIL @ ${bare.finalPosition.x},${bare.finalPosition.y} ${bare.deathMessage ?? "stuck"}`,
    );
  }
}

console.log(`Verified levels where tws pass: autoplay fail=${autoplayFail}, bare fail=${bareFail}`);
