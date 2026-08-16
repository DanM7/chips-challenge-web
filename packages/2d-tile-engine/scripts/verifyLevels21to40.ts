/**
 * First-sweep verify for CC1 MS levels 21–40: replay TWS + existing Auto Play
 * letters. No engine rule changes. Exact rem === bold → verified_bold.
 *
 * npx tsx packages/2d-tile-engine/scripts/verifyLevels21to40.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  runnerToResult,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import { replayTwsRecords, type TwsTickMove } from "../engine/twsReplay.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(root, "../..");
const pack = path.join(
  repoRoot,
  "apps/chips-challenge-web/public/games/chips-challenge-1",
);
const levelsDir = path.join(pack, "levels");
const webSolutionsDir = path.join(pack, "data/cc1-ms-solutions");
const statusPath = path.join(webSolutionsDir, "status-21-40.json");
const FROM = 21;
const TO = 40;

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const DIR_LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

interface WebEntry {
  levelId: string;
  passwordMs?: string;
  title?: string;
  timeLimitSeconds?: number;
  boldTimeRemaining?: number;
  minChipMoves?: number;
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

function twsRecordsToLetters(records: TwsTickMove[]): string[] {
  const letters: string[] = [];
  let prevTick = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap + 1; i += 1) letters.push("W");
    letters.push(DIR_LETTER[dir]);
    prevTick = rec.tick;
  }
  return letters;
}

function simulateLetters(level: LevelData, letters: string[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const action of decodeSolutionMoves(letters)) {
    if (action === "wait") stepMsCc1Wait(runner);
    else stepMsCc1Simulation(runner, action);
    if (runner.completed || runner.playerDied) break;
  }
  const result = runnerToResult(runner);
  const limit = level.timeLimit;
  const rem =
    limit != null && limit > 0 ? msSecondsRemaining(limit, runner.buttonPressCtx.moveBoundary) : null;
  return {
    ...result,
    rem,
    ticks: runner.buttonPressCtx.moveBoundary,
    pos: result.finalPosition,
  };
}

type Status = "verified_bold" | "in_progress" | "pending" | "blocked" | "best_effort_rng";

interface BoardRow {
  level: number;
  title: string;
  bold: number;
  status: Status;
  notes: string;
}

const board: BoardRow[] = [];

for (let n = FROM; n <= TO; n += 1) {
  const web = loadWeb(n);
  const level = loadLevel(n);
  const bold = web.boldTimeRemaining ?? 0;
  const title = web.title ?? `Level ${n}`;
  const eng = readLevelSolution<{
    twsRecords?: TwsTickMove[];
    moveSource?: string;
  }>(n);

  type Attempt = {
    kind: "web" | "tws";
    letters: string[];
    rem: number | null;
    ticks: number;
    completed: boolean;
    died: boolean;
    death?: string;
    pos: { x: number; y: number };
  };
  const attempts: Attempt[] = [];

  if (web.moves?.length) {
    const r = simulateLetters(level, web.moves);
    attempts.push({
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

  if (eng?.twsRecords?.length) {
    const withWaits = twsRecordsToLetters(eng.twsRecords);
    const rWait = simulateLetters(level, withWaits);
    attempts.push({
      kind: "tws",
      letters: withWaits,
      rem: rWait.rem,
      ticks: rWait.ticks,
      completed: rWait.completed,
      died: rWait.playerDied,
      death: rWait.deathMessage,
      pos: rWait.pos,
    });
    const chipOnly = eng.twsRecords
      .map((rec) => TWS_DIR[rec.direction])
      .filter((d): d is Direction => d != null)
      .map((d) => DIR_LETTER[d]);
    const rChip = simulateLetters(level, chipOnly);
    attempts.push({
      kind: "tws",
      letters: chipOnly,
      rem: rChip.rem,
      ticks: rChip.ticks,
      completed: rChip.completed,
      died: rChip.playerDied,
      death: rChip.deathMessage,
      pos: rChip.pos,
    });
  }

  const completing = attempts.filter((a) => a.completed && !a.died);
  const exact = completing.find((a) => a.rem === bold);
  const best = completing.sort((a, b) => (b.rem ?? -1) - (a.rem ?? -1))[0];
  const failed = attempts.filter((a) => !a.completed || a.died);
  const blobLevel = n === 23;

  let status: Status;
  let notes: string;
  let write: WebEntry | null = null;

  if (exact) {
    status = blobLevel ? "best_effort_rng" : "verified_bold";
    notes = `${exact.kind} route rem ${exact.rem} (${exact.letters.length} letters, ${exact.ticks} ticks)`;
    write = {
      ...web,
      moves: encodeSolutionMoves(decodeSolutionMoves(exact.letters)),
      moveVerified: true,
      meetsBoldBudget: !blobLevel,
      simulatedSecondsRemaining: exact.rem ?? undefined,
      moveSource:
        exact.kind === "tws"
          ? "CC1-ms TWS chip letters; exact bold"
          : web.moveSource ?? "existing Auto Play letters; exact bold",
    };
  } else if (best) {
    status = blobLevel ? "best_effort_rng" : "in_progress";
    const delta = (best.rem ?? 0) - bold;
    notes = `Completing ${best.kind} rem ${best.rem} (bold ${bold}, ${delta > 0 ? "+" : ""}${delta}s, ${best.ticks} ticks). First sweep, no engine change`;
    write = {
      ...web,
      moves: encodeSolutionMoves(decodeSolutionMoves(best.letters)),
      moveVerified: false,
      meetsBoldBudget: false,
      simulatedSecondsRemaining: best.rem ?? undefined,
      moveSource:
        best.kind === "tws"
          ? "CC1-ms TWS chip letters; completes but not exact bold"
          : web.moveSource ?? "existing Auto Play letters; completes but not exact bold",
    };
  } else if (failed.length) {
    const f = [...failed].sort((a, b) => b.ticks - a.ticks)[0]!;
    const where = `${f.pos.x},${f.pos.y}`;
    status = blobLevel ? "best_effort_rng" : "blocked";
    notes = blobLevel
      ? `Blobnet: TWS ${f.died ? "dies" : "stuck"} @ ${where}${f.death ? ` (${f.death})` : ""} after ${f.ticks} ticks — RNG blobs, second sweep`
      : `${f.kind} ${f.died ? "dies" : "stuck"} @ ${where}${f.death ? `: ${f.death}` : ""} after ${f.ticks} ticks`;
  } else {
    status = "pending";
    notes = "No TWS records or Auto Play letters";
  }

  if (write) {
    fs.writeFileSync(
      path.join(webSolutionsDir, `level-${String(n).padStart(3, "0")}.json`),
      `${JSON.stringify(write, null, 2)}\n`,
    );
  }

  board.push({ level: n, title, bold, status, notes });
  const tag = status === "verified_bold" ? "OK" : status === "in_progress" ? "~" : "X";
  console.log(
    `${String(n).padStart(3)} ${tag} ${status.padEnd(16)} rem=${best?.rem ?? exact?.rem ?? "-"} bold=${bold} ${notes.slice(0, 90)}`,
  );
}

const doc = {
  schemaVersion: 1,
  description:
    "Tracking board for CC1 MS Auto Play bold routes (levels 21–40). First sweep: TWS/existing letters only, no engine changes.",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_21-40",
  statusLegend: {
    verified_bold: "moveVerified + simulation rem === boldTimeRemaining",
    in_progress: "Completing route but rem !== bold",
    pending: "No route to replay",
    blocked: "TWS/existing route dies or sticks under current engine",
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
