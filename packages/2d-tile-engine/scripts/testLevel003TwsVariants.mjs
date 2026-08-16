import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { parseCcMoveString, parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-003.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);
const tws = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../integration/data/cc1-ms-solutions.json"), "utf8"),
).levels["3"].twsMoves;

for (const [label, moves] of [
  ["ms", parseCcMoveStringMs(tws)],
  ["legacy", parseCcMoveString(tws)],
]) {
  const r = simulateMsCc1Level(structuredClone(level), moves);
  console.log(label, moves.length, "completed", r.completed, "died", r.playerDied, "chips", r.finalPlayerState?.chipsRemainingOnMap);
}
