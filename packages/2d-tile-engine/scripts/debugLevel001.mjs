import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { parseCcMoveString, parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelPath = path.join(
  __dirname,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
);
const level = JSON.parse(fs.readFileSync(levelPath, "utf8"));
normalizeLevelLayers(level);

let chips = 0;
const tallies = {};
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    const t = getCompositeTile(level, x, y);
    if (t === "chip") chips += 1;
    if (t.startsWith("key_") || t.startsWith("door_")) {
      tallies[t] = (tallies[t] ?? 0) + 1;
    }
  }
}
console.log("chips on map:", chips, "chipsRequired:", level.chipsRequired);
console.log("keys/doors:", tallies);

const goldenTws =
  "2L,,l,,l,,L3,2Rr,,Rr,,2Rr,,R,,RLl,,Ll,,L3,Dd,d,,D,D,2Ll,L,LDd,,D3U5R2DR3,Rr,,2R,u,,2U,Dd,,D5L,d,,D3L4Rr,,R,Ll,,L,,Dd,,Dd,,Dd,,d";

for (const [label, parse] of [
  ["legacy", parseCcMoveString],
  ["ms", parseCcMoveStringMs],
]) {
  const moves = parse(goldenTws);
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  console.log(`\n=== ${label} (${moves.length} moves) ===`);
  for (let i = 0; i < moves.length; i++) {
    const before = { x: runner.gx, y: runner.gy, chips: runner.playerState.chipsRemainingOnMap };
    stepMsCc1Simulation(runner, moves[i]);
    const moved = before.x !== runner.gx || before.y !== runner.gy;
    if (!moved || i < 25 || i >= moves.length - 3) {
      const tile = getCompositeTile(runner.level, runner.gx, runner.gy);
      console.log(
        `${String(i + 1).padStart(2)} ${moves[i].padEnd(5)}`,
        moved ? `${before.x},${before.y}->${runner.gx},${runner.gy}` : "BLOCKED",
        `chips=${runner.playerState.chipsRemainingOnMap}`,
        `keys=${runner.playerState.keys.join("+") || "-"}`,
        tile,
      );
    }
    if (runner.completed || runner.playerDied) break;
  }
  console.log(
    "final",
    runner.gx,
    runner.gy,
    "chips",
    runner.playerState.chipsRemainingOnMap,
    "completed",
    runner.completed,
    runner.deathMessage ?? "",
  );
}
