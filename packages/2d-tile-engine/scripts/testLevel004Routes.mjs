import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
import {
  createMsCc1SimulationRunner,
  simulateMsCc1Level,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-004.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);
const doc = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../integration/data/cc1-ms-solutions.json"), "utf8"),
);

for (const [label, moves] of [
  ["stored", doc.levels["4"].moves],
  ["tws", parseCcMoveStringMs(doc.levels["4"].twsMoves)],
]) {
  const r = simulateMsCc1Level(structuredClone(level), moves);
  console.log(
    label,
    moves.length,
    "completed",
    r.completed,
    "died",
    r.playerDied,
    "chips",
    r.finalPlayerState?.chipsRemainingOnMap,
    "pos",
    r.finalPosition?.x,
    r.finalPosition?.y,
    r.deathMessage ?? "",
  );
  if (!r.completed && !r.playerDied) {
    const runner = createMsCc1SimulationRunner(structuredClone(level));
    for (let i = 0; i < moves.length; i++) {
      stepMsCc1Simulation(runner, moves[i]);
      if (runner.playerDied || runner.completed) {
        console.log("  stall/die at", i + 1, moves[i], runner.gx, runner.gy, runner.playerState.chipsRemainingOnMap);
        break;
      }
    }
  }
}
