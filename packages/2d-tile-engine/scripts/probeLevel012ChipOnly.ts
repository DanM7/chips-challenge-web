import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = JSON.parse(
  readFileSync("integration/data/cc1-ms-solutions/level-012.json", "utf8"),
);
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];

const moves: Direction[] = sol.twsRecords.map(
  (r: { direction: number }) => TWS_DIR[r.direction]!,
);

const r = createMsCc1SimulationRunner(structuredClone(level));
let i = 0;
for (const d of moves) {
  stepMsCc1Simulation(r, d);
  i++;
  if (r.playerDied || r.completed) break;
  if (i % 50 === 0) {
    console.log(
      "ok",
      i,
      `${r.gx},${r.gy}`,
      "chips",
      r.playerState.chipsRemainingOnMap,
      "teeth",
      r.monsters.map((m) => `${m.x},${m.y}`).join(";"),
    );
  }
}
console.log({
  i,
  completed: r.completed,
  died: r.playerDied,
  death: r.deathMessage,
  pos: `${r.gx},${r.gy}`,
  chips: r.playerState.chipsRemainingOnMap,
  ticks: r.buttonPressCtx.moveBoundary,
  rem: msSecondsRemaining(400, r.buttonPressCtx.moveBoundary),
  teeth: r.monsters.map((m) => `${m.x},${m.y}:${m.direction}`),
});
