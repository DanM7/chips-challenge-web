import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
import { simulateMsCc1Level } from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelNum = Number.parseInt(process.argv[2] ?? "1", 10);
const moveString = process.argv[3];
if (!moveString) {
  console.error("Usage: npx tsx scripts/verifyTwsSolution.ts <levelNum> <moveString>");
  process.exit(1);
}

const levelPath = path.join(
  __dirname,
  `../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(levelNum).padStart(3, "0")}.json`,
);
const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
normalizeLevelLayers(level);
const moves = parseCcMoveStringMs(moveString);
const result = simulateMsCc1Level(structuredClone(level), moves);
console.log(
  JSON.stringify(
    {
      levelNum,
      moveCount: moves.length,
      chipMoves: result.chipMoves,
      completed: result.completed,
      playerDied: result.playerDied,
      deathMessage: result.deathMessage,
      final: result.finalPosition,
      chipsLeft: result.finalPlayerState.chipsRemainingOnMap,
    },
    null,
    2,
  ),
);
