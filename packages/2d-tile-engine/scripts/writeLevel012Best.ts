/**
 * Write best verified Hunt route (rem 266) with level-005 metadata pattern.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
);
const webSolPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-012.json",
);

const OPP: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function loadLevel(): LevelData {
  const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function verify(level: LevelData, moves: Direction[]) {
  let r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of moves) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) return { ok: false, rem: 0, ticks: 0, chipMoves: r.chipMoves, r };
    if (r.completed) break;
  }
  return {
    ok: r.completed,
    rem: msSecondsRemaining(400, r.buttonPressCtx.moveBoundary),
    ticks: r.buttonPressCtx.moveBoundary,
    chipMoves: r.chipMoves,
    r,
  };
}

const level = loadLevel();
const raw = JSON.parse(fs.readFileSync(webSolPath, "utf8"));
let moves = decodeSolutionMoves(raw.moves) as Direction[];

// Strip cancel pairs while valid
{
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < moves.length - 1; i++) {
      if (OPP[moves[i]!] !== moves[i + 1]) continue;
      const trial = [...moves.slice(0, i), ...moves.slice(i + 2)];
      if (verify(level, trial).ok) {
        moves = trial;
        changed = true;
        break;
      }
    }
  }
}

const v = verify(level, moves);
if (!v.ok) {
  console.error("route invalid");
  process.exit(1);
}

const waits = moves.filter((m) => false).length; // no waits in this route
const chipMoveLetters = moves.length;

const entry = {
  levelId: "level-012",
  passwordMs: "WVHI",
  title: "Hunt",
  timeLimitSeconds: 400,
  boldTimeRemaining: 270,
  minChipMoves: 130,
  moves: encodeSolutionMoves(moves),
  source: "https://scores.bitbusters.club/levels/cc1/12/ms",
  walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
  boldRouteHint:
    "U 12L 4U 3R 2D, east/west rows, lodge teeth, center at ~100-150 left; chipsRequired 652",
  moveVerified: v.rem === 270,
  meetsBoldBudget: v.rem >= 270,
  moveSource: `TWS-hybrid + endgame beam + pair-strip; engine rem ${v.rem} (bold 270) — ${270 - v.rem}s short`,
  simulatedTicks: v.ticks,
  simulatedSecondsRemaining: v.rem,
  boldGapNote:
    v.rem === 270
      ? undefined
      : `Completes verified; ${v.rem} remaining vs bold 270 (need ~${v.ticks - 654} fewer ticks). TWS dies at move 220 (teeth). Theoretical min ~654 ticks for rem 270.`,
};

fs.writeFileSync(webSolPath, `${JSON.stringify(entry, null, 2)}\n`);
console.log({
  success: v.ok,
  rem: v.rem,
  bold: 270,
  exact270: v.rem === 270,
  moves: moves.length,
  chipMoves: v.chipMoves,
  ticks: v.ticks,
  waits: 0,
  chipsRequired: level.chipsRequired,
  blockers: entry.boldGapNote,
});
