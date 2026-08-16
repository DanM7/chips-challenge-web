import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";

const level = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

const r = createMsCc1SimulationRunner(structuredClone(level));
console.log(
  "start traps",
  isTrapOpen(r.buttonPressCtx, 18, 7),
  isTrapOpen(r.buttonPressCtx, 18, 10),
);
console.log("monsters", r.monsters.map((m) => ({ kind: m.kind, x: m.x, y: m.y })));

const runner = createMsCc1SimulationRunner(structuredClone(level));
stepMsCc1Simulation(runner, "left");
console.log("after L", runner.gx, runner.gy);
for (let w = 0; w < 30; w++) {
  stepMsCc1Wait(runner);
  if ((w + 1) % 10 === 0) {
    console.log(
      "w",
      w + 1,
      "t1",
      isTrapOpen(runner.buttonPressCtx, 18, 7),
      "t2",
      isTrapOpen(runner.buttonPressCtx, 18, 10),
      "mons",
      runner.monsters.map((m) => `${m.kind}@${m.x},${m.y}`),
    );
  }
}
