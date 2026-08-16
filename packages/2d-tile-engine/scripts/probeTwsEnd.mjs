import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction } from "../engine/types.js";
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
    path.join(__dirname, "../../../../cc1-asset-extraction-pipeline/.tmp-level1"),
    "utf8",
  ),
);
normalizeLevelLayers(level);

const twsList = [
  ["pieguy", "2L,,l,,l,,L3,2Rr,,Rr,,2Rr,,R,,RLl,,Ll,,L3,Dd,d,,D,D,2Ll,L,LDd,,D3U5R2DR3,Rr,,2R,u,,2U,Dd,,D5L,d,,D3L4Rr,,R,Ll,,L,,Dd,,Dd,,Dd,,d"],
  ["tw132", "3L,,2Lr,,r,,8R5L5D5L3D3U4R,,d,,d,,R2D4R,u,,UR3U3D5L2D3L6R3L6Dd"],
  ["readme", "5L3R3,r,,4Rr,,R2Ll,,2L5D5L3D3U5R2D5R3U3D5L,Dd,,R,r,,R,l,,5L3R6D,,d"],
];

for (const [label, tws] of twsList) {
  const moves = parseCcMoveStringMs(tws);
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let effective = 0;
  for (const d of moves) {
    const bx = runner.gx;
    const by = runner.gy;
    stepMsCc1Simulation(runner, d);
    if (runner.gx !== bx || runner.gy !== by) effective++;
    if (runner.completed || runner.playerDied) break;
  }
  console.log(label, {
    parsed: moves.length,
    effective,
    pos: [runner.gx, runner.gy],
    chips: runner.playerState.chipsRemainingOnMap,
    keys: runner.playerState.keys,
    completed: runner.completed,
    tile: getCompositeTile(runner.level, runner.gx, runner.gy),
  });
}

// Probe from TWS end state: try each direction
const golden = parseCcMoveStringMs(twsList[0][1]);
const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const d of golden) stepMsCc1Simulation(runner, d);
console.log("\nFrom stall, try moves:");
for (const d of ["up", "down", "left", "right"] as Direction[]) {
  const probe = structuredClone(runner);
  const { cloneMsCc1SimulationRunner, stepMsCc1Simulation: step } = await import(
    "../engine/msCc1/msCc1Simulation.js"
  );
  const p = cloneMsCc1SimulationRunner(runner);
  const ok = step(p, d);
  console.log(
    d,
    ok ? "moved" : "blocked",
    `-> (${p.gx},${p.gy})`,
    "chips",
    p.playerState.chipsRemainingOnMap,
    getCompositeTile(p.level, p.gx, p.gy),
  );
}
