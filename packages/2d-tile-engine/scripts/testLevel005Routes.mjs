import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { parseCcMoveStringMs, parseCcMoveString } from "../engine/ccMoveNotation.js";
import {
  createMsCc1SimulationRunner,
  simulateMsCc1Level,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { getCompositeTile } from "../engine/levelRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);
const doc = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../integration/data/cc1-ms-solutions.json"), "utf8"),
).levels["5"];

for (const [label, moves] of [
  ["stored", doc.moves],
  ["twsMs", parseCcMoveStringMs(doc.twsMoves)],
  ["twsLegacy", parseCcMoveString(doc.twsMoves)],
]) {
  const r = simulateMsCc1Level(structuredClone(level), moves);
  console.log(label, JSON.stringify(moves), "completed", r.completed, "died", r.playerDied, "pos", r.finalPosition);
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (let i = 0; i < moves.length; i++) {
    stepMsCc1Simulation(runner, moves[i]);
    console.log(
      " ",
      i + 1,
      moves[i],
      runner.gx,
      runner.gy,
      getCompositeTile(runner.level, runner.gx, runner.gy),
      runner.completed ? "WIN" : "",
      runner.playerDied ? "DIED" : "",
    );
    if (runner.completed || runner.playerDied) break;
  }
}
