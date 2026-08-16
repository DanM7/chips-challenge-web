import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-004.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);
const moves = parseCcMoveStringMs(
  JSON.parse(fs.readFileSync(path.join(__dirname, "../integration/data/cc1-ms-solutions.json"), "utf8"))
    .levels["4"].twsMoves,
);

const runner = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < moves.length; i++) {
  const m = moves[i];
  const bugs = runner.monsters.filter((x) => x.alive).map((x) => `(${x.x},${x.y})${x.direction[0]}`).join(" ");
  const before = { x: runner.gx, y: runner.gy };
  stepMsCc1Simulation(runner, m);
  if (i >= moves.length - 12 || runner.playerDied) {
    console.log(
      `#${i + 1} ${m}`,
      `${before.x},${before.y}->${runner.gx},${runner.gy}`,
      getCompositeTile(runner.level, runner.gx, runner.gy),
      `chips=${runner.playerState.chipsRemainingOnMap}`,
      `bugs=${bugs}`,
    );
  }
  if (runner.playerDied) break;
}
console.log("end", runner.gx, runner.gy, runner.playerState.chipsRemainingOnMap);
