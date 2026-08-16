/**

 * Batch-verify CC1 solution routes for a level range.

 *

 * Run: npx tsx scripts/batchVerifySolutions.ts [fromLevel] [toLevel]

 * Report: integration/data/batch-verify-report-{from}-{to}.json

 */

import fs from "fs";

import path from "path";

import { fileURLToPath } from "url";

import type { Direction, LevelData } from "../engine/types.js";

import { normalizeLevelLayers } from "../engine/levelLayers.js";

import { simulateMsCc1AutoplayLevel } from "../engine/msCc1/msCc1Simulation.js";

import { decodeSolutionMoves } from "../engine/solutionMoves.js";

import { listLevelNumbers, readIndex, readLevelSolution } from "../integration/solutionStorage.js";

import { replayTwsMs, replayTwsRecords, type TwsTickMove } from "../engine/twsReplay.js";



const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.join(__dirname, "..");

const fromLevel = Number.parseInt(process.argv[2] ?? "1", 10);

const toLevel = Number.parseInt(process.argv[3] ?? "149", 10);

const reportPath = path.join(

  root,

  `integration/data/batch-verify-report-${fromLevel}-${toLevel}.json`,

);

const levelsDir = path.join(

  root,

  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",

);



interface SolutionEntry {

  levelId: string;

  moves: string[] | null;

  twsMoves?: string;

  twsRecords?: TwsTickMove[];

  moveVerified?: boolean;

}



interface LevelReport {

  level: number;

  levelId: string;

  levelMissing: boolean;

  moveVerified: boolean;

  autoplay: {

    status: "pass" | "fail" | "skip";

    moveCount: number;

    completed: boolean;

    playerDied: boolean;

    deathMessage?: string;

    finalPosition?: { x: number; y: number };

  };

  tws: {

    status: "pass" | "fail" | "skip";

    moveCount: number;

    waitTicks: number;

    completed: boolean;

    playerDied: boolean;

    deathMessage?: string;

    finalPosition?: { x: number; y: number };

  };

}



function loadLevel(levelId: string): LevelData | null {

  const file = path.join(levelsDir, `${levelId}.json`);

  if (!fs.existsSync(file)) {

    return null;

  }

  const level = JSON.parse(fs.readFileSync(file, "utf8")) as LevelData;

  normalizeLevelLayers(level);

  return level;

}



function autoplayStatus(level: LevelData, entry: SolutionEntry): LevelReport["autoplay"] {

  if (entry.moveVerified !== true || !entry.moves?.length) {

    return { status: "skip", moveCount: 0, completed: false, playerDied: false };

  }

  const result = simulateMsCc1AutoplayLevel(structuredClone(level), decodeSolutionMoves(entry.moves));

  return {

    status: result.completed && !result.playerDied ? "pass" : "fail",

    moveCount: entry.moves.length,

    completed: result.completed,

    playerDied: result.playerDied,

    deathMessage: result.deathMessage,

    finalPosition: result.finalPosition,

  };

}



function twsStatus(level: LevelData, entry: SolutionEntry): LevelReport["tws"] {

  if (entry.twsRecords?.length) {

    const result = replayTwsRecords(level, entry.twsRecords);

    return {

      status: result.completed && !result.playerDied ? "pass" : "fail",

      moveCount: result.chipMoves.length,

      waitTicks: result.waitTicks,

      completed: result.completed,

      playerDied: result.playerDied,

      deathMessage: result.deathMessage,

      finalPosition: result.finalPosition,

    };

  }

  if (!entry.twsMoves) {

    return { status: "skip", moveCount: 0, waitTicks: 0, completed: false, playerDied: false };

  }

  const result = replayTwsMs(level, entry.twsMoves);

  return {

    status: result.completed && !result.playerDied ? "pass" : "fail",

    moveCount: result.chipMoves.length,

    waitTicks: result.waitTicks,

    completed: result.completed,

    playerDied: result.playerDied,

    deathMessage: result.deathMessage,

    finalPosition: result.finalPosition,

  };

}



const levelNums = listLevelNumbers(readIndex()).filter((n) => n >= fromLevel && n <= toLevel);



const reports: LevelReport[] = [];

const started = Date.now();



for (const levelNum of levelNums) {
  const entry = readLevelSolution<SolutionEntry>(levelNum);
  if (!entry) {
    reports.push({
      level: levelNum,
      levelId: `level-${String(levelNum).padStart(3, "0")}`,
      levelMissing: true,
      moveVerified: false,
      autoplay: { status: "skip", moveCount: 0, completed: false, playerDied: false },
      tws: { status: "skip", moveCount: 0, waitTicks: 0, completed: false, playerDied: false },
    });
    continue;
  }

  const level = loadLevel(entry.levelId);

  if (!level) {

    reports.push({

      level: levelNum,

      levelId: entry.levelId,

      levelMissing: true,

      moveVerified: entry.moveVerified === true,

      autoplay: { status: "skip", moveCount: 0, completed: false, playerDied: false },

      tws: { status: "skip", moveCount: 0, waitTicks: 0, completed: false, playerDied: false },

    });

    continue;

  }



  reports.push({

    level: levelNum,

    levelId: entry.levelId,

    levelMissing: false,

    moveVerified: entry.moveVerified === true,

    autoplay: autoplayStatus(level, entry),

    tws: twsStatus(level, entry),

  });

}



const summary = {

  generatedAt: new Date().toISOString(),

  range: { from: fromLevel, to: toLevel },

  elapsedMs: Date.now() - started,

  totalLevels: reports.length,

  autoplayPass: reports.filter((r) => r.autoplay.status === "pass").length,

  autoplayFail: reports.filter((r) => r.autoplay.status === "fail").length,

  autoplaySkip: reports.filter((r) => r.autoplay.status === "skip").length,

  twsPass: reports.filter((r) => r.tws.status === "pass").length,

  twsFail: reports.filter((r) => r.tws.status === "fail").length,

  twsSkip: reports.filter((r) => r.tws.status === "skip").length,

  firstAutoplayFail: reports.find((r) => r.autoplay.status === "fail")?.level ?? null,

  firstAutoplaySkip: reports.find((r) => r.autoplay.status === "skip")?.level ?? null,

  firstTwsFail: reports.find((r) => r.tws.status === "fail")?.level ?? null,

  levels: reports,

};



fs.writeFileSync(reportPath, `${JSON.stringify(summary, null, 2)}\n`);



console.log(`\n=== CC1 batch verify (${fromLevel}–${toLevel}) ===`);

console.log(`Levels: ${summary.totalLevels} (${summary.elapsedMs}ms)`);

console.log(

  `Auto-play: ${summary.autoplayPass} pass, ${summary.autoplayFail} fail, ${summary.autoplaySkip} skip`,

);

console.log(`TWS replay: ${summary.twsPass} pass, ${summary.twsFail} fail, ${summary.twsSkip} skip`);

console.log(`Report: ${reportPath}`);



if (summary.firstAutoplaySkip != null) {

  console.log(`First no auto-play route: level ${summary.firstAutoplaySkip}`);

}

if (summary.firstAutoplayFail != null) {

  console.log(`First auto-play fail: level ${summary.firstAutoplayFail}`);

}

if (summary.firstTwsFail != null) {

  console.log(`First TWS replay fail: level ${summary.firstTwsFail}`);

}



console.log("\nTWS replay FAIL:");

for (const r of reports.filter((x) => x.tws.status === "fail")) {

  const p = r.tws.finalPosition;

  console.log(

    `  ${String(r.level).padStart(3)} ${r.tws.moveCount} moves @ ${p?.x},${p?.y} ${r.tws.deathMessage ?? "stuck"}`,

  );

}



console.log("\nTWS replay PASS:");

for (const r of reports.filter((x) => x.tws.status === "pass")) {

  console.log(`  ${String(r.level).padStart(3)} ${r.tws.moveCount} moves`);

}


