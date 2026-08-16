import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
import {
  createMsCc1SimulationRunner,
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
const moves = parseCcMoveStringMs(tws);
console.log("parsed", moves.length, moves.slice(0, 10).join(","));

const runner = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < moves.length; i++) {
  stepMsCc1Simulation(runner, moves[i]);
  if (runner.playerDied || runner.completed) {
    console.log(
      i + 1,
      moves[i],
      runner.gx,
      runner.gy,
      "tools",
      runner.playerState.tools,
      "chips",
      runner.playerState.chipsRemainingOnMap,
      runner.playerDied ? "DIED" : "WIN",
      runner.deathMessage ?? "",
    );
    process.exit(0);
  }
}
console.log("stall", runner.gx, runner.gy, runner.playerState);
