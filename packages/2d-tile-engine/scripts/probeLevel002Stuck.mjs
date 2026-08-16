import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

const tws =
  "L,2L10,r,,D8,2RUu,,2UR3ULULUL,,r,,D,RDRDd,,D2R5,D3,U,,L.L.L6DR2DL2D,,d,,2Dd,,LD2R,d";
const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const d of parseCcMoveStringMs(tws)) {
  stepMsCc1Simulation(runner, d);
  if (runner.completed || runner.playerDied) break;
}

console.log("TWS end", {
  pos: [runner.gx, runner.gy],
  chips: runner.playerState.chipsRemainingOnMap,
  tile: getCompositeTile(runner.level, runner.gx, runner.gy),
});

console.log("\nTry moves + waits from stall:");
const dirs = ["up", "down", "left", "right"];
for (const action of [...dirs, "wait"]) {
  const p = cloneMsCc1SimulationRunner(runner);
  const before = p.playerState.chipsRemainingOnMap;
  if (action === "wait") {
    stepMsCc1Wait(p);
  } else {
    stepMsCc1Simulation(p, action);
  }
  const moved = action !== "wait" || msCc1RunnerStateKey(p) !== msCc1RunnerStateKey(runner);
  console.log(
    action,
    p.playerDied ? "DIED" : "",
    `-> (${p.gx},${p.gy})`,
    "chips",
    p.playerState.chipsRemainingOnMap,
    before !== p.playerState.chipsRemainingOnMap ? "COLLECTED" : "",
    getCompositeTile(p.level, p.gx, p.gy),
  );
}

console.log("\nChips still on map:");
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    if (getCompositeTile(runner.level, x, y) === "chip") {
      console.log(`  chip at (${x},${y})`);
    }
  }
}

console.log("\nBlocks/water/dirt snapshot near play area:");
for (let y = 10; y <= 18; y++) {
  let row = "";
  for (let x = 18; x <= 26; x++) {
    row += getCompositeTile(runner.level, x, y).slice(0, 5).padEnd(6);
  }
  console.log(`${y}: ${row}`);
}
