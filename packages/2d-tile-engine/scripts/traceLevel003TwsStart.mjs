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

const runner = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < 6; i++) {
  const before = { x: runner.gx, y: runner.gy };
  const tileBefore = getCompositeTile(runner.level, before.x, before.y);
  stepMsCc1Simulation(runner, moves[i]);
  const destTile = getCompositeTile(runner.level, runner.gx, runner.gy);
  console.log(
    i + 1,
    moves[i],
    `${before.x},${before.y}(${tileBefore})->${runner.gx},${runner.gy}(${destTile})`,
    "tools",
    runner.playerState.tools,
  );
}
