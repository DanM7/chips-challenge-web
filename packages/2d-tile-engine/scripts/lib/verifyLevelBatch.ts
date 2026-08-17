/**
 * Shared CC1 MS Auto Play / TWS batch verifier.
 * Exact rem === bold on Auto Play letters → verified_bold.
 * TWS uses 1-cell-per-tick slides; Auto Play letters still instant-chain.
 * Untimed (T-Chip) remaining time is scored as if the clock were 999.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  runnerToResult,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../../engine/solutionMoves.js";
import { replayTwsRecords, type TwsTickMove } from "../../engine/twsReplay.js";
import type { Direction, LevelData } from "../../engine/types.js";
import { readLevelSolution } from "../../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.join(root, "../..");
const pack = path.join(
  repoRoot,
  "apps/chips-challenge-web/public/games/chips-challenge-1",
);
const levelsDir = path.join(pack, "levels");
const webSolutionsDir = path.join(pack, "data/cc1-ms-solutions");

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const DIR_LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

export type BatchStatus =
  | "verified_bold"
  | "in_progress"
  | "pending"
  | "blocked"
  | "best_effort_rng";

export interface VerifyLevelBatchOptions {
  from: number;
  to: number;
  description: string;
  walkthroughUrl: string;
  extraNotes?: (level: number, status: BatchStatus) => string;
}

interface WebEntry {
  levelId: string;
  passwordMs?: string;
  title?: string;
  timeLimitSeconds?: number | null;
  boldTimeRemaining?: number;
  minChipMoves?: number | null;
  moves: string[] | null;
  moveVerified?: boolean;
  meetsBoldBudget?: boolean;
  simulatedSecondsRemaining?: number;
  moveSource?: string;
  source?: string;
  rngSeed?: number;
}

function loadLevel(n: number): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, `level-${String(n).padStart(3, "0")}.json`), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function loadWeb(n: number): WebEntry {
  return JSON.parse(
    fs.readFileSync(path.join(webSolutionsDir, `level-${String(n).padStart(3, "0")}.json`), "utf8"),
  ) as WebEntry;
}

function hasBlobTiles(level: LevelData): boolean {
  return [level.layers.lower, level.layers.upper].some((layer) =>
    layer.some((tile) => tile.startsWith("blob_")),
  );
}

function isTChip(level: LevelData): boolean {
  return level.timeLimit == null || level.timeLimit <= 0;
}

function twsRecordsToLetters(records: TwsTickMove[]): string[] {
  const letters: string[] = [];
  let prevTick = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap; i += 1) letters.push("W");
    letters.push(DIR_LETTER[dir]);
    prevTick = rec.tick;
  }
  return letters;
}

function remOf(level: LevelData, ticks: number): number | null {
  const limit = isTChip(level) ? 999 : level.timeLimit;
  return limit != null && limit > 0 ? msSecondsRemaining(limit, ticks) : null;
}

function simulateLetters(level: LevelData, letters: string[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const action of decodeSolutionMoves(letters)) {
    if (action === "wait") stepMsCc1Wait(runner);
    else stepMsCc1Simulation(runner, action);
    if (runner.completed || runner.playerDied) break;
  }
  const result = runnerToResult(runner);
  return {
    ...result,
    rem: remOf(level, runner.buttonPressCtx.moveBoundary),
    ticks: runner.buttonPressCtx.moveBoundary,
    pos: result.finalPosition,
  };
}

export const VERIFY_BATCH_PRESETS: Record<string, VerifyLevelBatchOptions> = {
  "21-40": {
    from: 21,
    to: 40,
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_21-40",
    description:
      "Tracking board for CC1 MS Auto Play bold routes (levels 21–40). Second sweep: TWS 1-cell/tick slides; Auto Play letters still instant-chain; exit no longer requires chips remaining.",
    extraNotes: (n, status) =>
      n === 39 && status === "in_progress"
        ? "; corner-exit bold needs teeth lure (exit no longer requires 0 chips)"
        : "",
  },
  "41-60": {
    from: 41,
    to: 60,
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_41-60",
    description:
      "Tracking board for CC1 MS Auto Play bold routes (levels 41–60). First sweep: TWS tick-slide replay + existing Auto Play letters; exact rem === bold for verified_bold. Bold times from https://scores.bitbusters.club/levels/cc1 (MS Bold column).",
  },
  "61-80": {
    from: 61,
    to: 80,
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_61-80",
    description:
      "Tracking board for CC1 MS Auto Play bold routes (levels 61–80). First sweep: TWS tick-slide replay + existing Auto Play letters; exact rem === bold for verified_bold. T-Chip remaining time scored as if the clock were 999. Bold times from https://scores.bitbusters.club/levels/cc1 (MS Bold column).",
  },
};

export async function runVerifyLevelBatch(options: VerifyLevelBatchOptions): Promise<void> {
  const { from, to, description, walkthroughUrl, extraNotes } = options;
  const statusPath = path.join(webSolutionsDir, `status-${from}-${to}.json`);
  const board: Array<{
    level: number;
    title: string;
    bold: number;
    status: BatchStatus;
    notes: string;
  }> = [];

  for (let n = from; n <= to; n += 1) {
    const web = loadWeb(n);
    const level = loadLevel(n);
    const bold = web.boldTimeRemaining ?? 0;
    const title = web.title ?? `Level ${n}`;
    const eng = readLevelSolution<{
      twsRecords?: TwsTickMove[];
      moveSource?: string;
    }>(n);
    const blobLevel = hasBlobTiles(level);
    const tChipNote = isTChip(level) ? " (T-Chip 999 clock)" : "";

    type LetterAttempt = {
      kind: "web" | "tws-letters";
      letters: string[];
      rem: number | null;
      ticks: number;
      completed: boolean;
      died: boolean;
      death?: string;
      pos: { x: number; y: number };
    };
    const letters: LetterAttempt[] = [];

    if (web.moves?.length) {
      const r = simulateLetters(level, web.moves);
      letters.push({
        kind: "web",
        letters: web.moves,
        rem: r.rem,
        ticks: r.ticks,
        completed: r.completed,
        died: r.playerDied,
        death: r.deathMessage,
        pos: r.pos,
      });
    }

    const recs = eng?.twsRecords ?? [];
    let twsTick: ReturnType<typeof replayTwsRecords> | null = null;
    if (recs.length) {
      twsTick = replayTwsRecords(structuredClone(level), recs);
      const withWaits = twsRecordsToLetters(recs);
      const rWait = simulateLetters(level, withWaits);
      letters.push({
        kind: "tws-letters",
        letters: withWaits,
        rem: rWait.rem,
        ticks: rWait.ticks,
        completed: rWait.completed,
        died: rWait.playerDied,
        death: rWait.deathMessage,
        pos: rWait.pos,
      });
      const chipOnly = recs
        .map((rec) => TWS_DIR[rec.direction])
        .filter((d): d is Direction => d != null)
        .map((d) => DIR_LETTER[d]);
      const rChip = simulateLetters(level, chipOnly);
      letters.push({
        kind: "tws-letters",
        letters: chipOnly,
        rem: rChip.rem,
        ticks: rChip.ticks,
        completed: rChip.completed,
        died: rChip.playerDied,
        death: rChip.deathMessage,
        pos: rChip.pos,
      });
    }

    const completingLetters = letters.filter((a) => a.completed && !a.died);
    const exact = completingLetters.find((a) => a.rem === bold);
    const bestLetters = completingLetters.sort((a, b) => (b.rem ?? -1) - (a.rem ?? -1))[0];
    const twsOk = twsTick != null && twsTick.completed && !twsTick.playerDied;
    const twsRem = twsTick ? remOf(level, twsTick.moveBoundary) : null;

    let status: BatchStatus;
    let notes: string;
    let write: WebEntry | null = null;

    if (exact) {
      status = blobLevel ? "best_effort_rng" : "verified_bold";
      notes = `Auto Play ${exact.kind} rem ${exact.rem}${tChipNote} (${exact.letters.length} letters, ${exact.ticks} ticks)`;
      write = {
        ...web,
        moves: encodeSolutionMoves(decodeSolutionMoves(exact.letters)),
        moveVerified: true,
        meetsBoldBudget: !blobLevel,
        simulatedSecondsRemaining: exact.rem ?? undefined,
        moveSource:
          exact.kind === "tws-letters"
            ? "CC1-ms TWS as Auto Play letters; exact bold"
            : web.moveSource ?? "existing Auto Play letters; exact bold",
      };
    } else if (bestLetters) {
      status = blobLevel ? "best_effort_rng" : "in_progress";
      const delta = (bestLetters.rem ?? 0) - bold;
      notes = `Completing Auto Play rem ${bestLetters.rem}${tChipNote} (bold ${bold}, ${delta > 0 ? "+" : ""}${delta}s, ${bestLetters.ticks} ticks)`;
      if (twsOk && twsRem !== bestLetters.rem) {
        notes += `; TWS tick-slide rem ${twsRem}`;
      }
      write = {
        ...web,
        moves: encodeSolutionMoves(decodeSolutionMoves(bestLetters.letters)),
        moveVerified: false,
        meetsBoldBudget: false,
        simulatedSecondsRemaining: bestLetters.rem ?? undefined,
        moveSource:
          bestLetters.kind === "tws-letters"
            ? "CC1-ms TWS as Auto Play letters; completes but not exact bold"
            : web.moveSource ?? "existing Auto Play letters; completes but not exact bold",
      };
    } else if (twsOk) {
      status = blobLevel ? "best_effort_rng" : "in_progress";
      const delta = (twsRem ?? 0) - bold;
      notes = `TWS tick-slide completes rem ${twsRem}${tChipNote} (bold ${bold}, ${delta > 0 ? "+" : ""}${delta}s, ${twsTick!.moveBoundary} ticks); Auto Play letters cannot encode 1-cell slides`;
    } else if (twsTick || letters.length) {
      const failedLetters = letters.filter((a) => !a.completed || a.died);
      const letterFail = [...failedLetters].sort((a, b) => b.ticks - a.ticks)[0];
      const twsPos = twsTick?.finalPosition;
      const where = twsPos
        ? `${twsPos.x},${twsPos.y}`
        : letterFail
          ? `${letterFail.pos.x},${letterFail.pos.y}`
          : "?";
      const died = twsTick?.playerDied ?? letterFail?.died ?? false;
      const death = twsTick?.deathMessage ?? letterFail?.death;
      const ticks = twsTick?.moveBoundary ?? letterFail?.ticks ?? 0;
      status = blobLevel ? "best_effort_rng" : "blocked";
      notes = blobLevel
        ? `Blob RNG: TWS ${died ? "dies" : "stuck"} @ ${where}${death ? ` (${death})` : ""} after ${ticks} ticks`
        : `TWS tick-slide ${died ? "dies" : "stuck"} @ ${where}${death ? `: ${death}` : ""} after ${ticks} ticks`;
    } else {
      status = "pending";
      notes = "No TWS records or Auto Play letters";
    }

    notes += extraNotes?.(n, status) ?? "";

    if (write) {
      fs.writeFileSync(
        path.join(webSolutionsDir, `level-${String(n).padStart(3, "0")}.json`),
        `${JSON.stringify(write, null, 2)}\n`,
      );
    }

    board.push({ level: n, title, bold, status, notes });
    const tag = status === "verified_bold" ? "OK" : status === "in_progress" ? "~" : "X";
    console.log(
      `${String(n).padStart(3)} ${tag} ${status.padEnd(16)} rem=${bestLetters?.rem ?? twsRem ?? "-"} bold=${bold} ${notes.slice(0, 100)}`,
    );
  }

  const doc = {
    schemaVersion: 1,
    description,
    walkthroughUrl,
    statusLegend: {
      verified_bold: "moveVerified + Auto Play simulation rem === boldTimeRemaining",
      in_progress: "Completing Auto Play or TWS tick-slide route but rem !== bold",
      pending: "No route to replay",
      blocked: "TWS tick-slide dies or sticks under current engine",
      best_effort_rng: "Non-deterministic (walkers/blobs)",
    },
    summary: {
      verified_bold: board.filter((r) => r.status === "verified_bold").length,
      in_progress: board.filter((r) => r.status === "in_progress").length,
      blocked: board.filter((r) => r.status === "blocked").length,
      pending: board.filter((r) => r.status === "pending").length,
      best_effort_rng: board.filter((r) => r.status === "best_effort_rng").length,
    },
    levels: board,
  };

  fs.writeFileSync(statusPath, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`\nWrote ${statusPath}`);
  console.log(doc.summary);
}

export async function runPresetBatch(preset: keyof typeof VERIFY_BATCH_PRESETS): Promise<void> {
  const options = VERIFY_BATCH_PRESETS[preset];
  if (!options) {
    throw new Error(`Unknown verify batch preset: ${String(preset)}`);
  }
  await runVerifyLevelBatch(options);
}
