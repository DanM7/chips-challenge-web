import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
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

function replay(parity: "even" | "odd", withWaits: boolean) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  let prev = 0;
  let i = 0;
  for (const rec of sol.twsRecords) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    if (withWaits) {
      const gap = Math.max(0, rec.tick - prev - 1);
      for (let j = 0; j < gap; j++) stepMsCc1Wait(r);
      stepMsCc1Wait(r);
    }
    stepMsCc1Simulation(r, dir);
    i++;
    if (r.playerDied || r.completed) {
      return {
        parity,
        withWaits,
        i,
        completed: r.completed,
        died: r.playerDied,
        death: r.deathMessage,
        pos: `${r.gx},${r.gy}`,
        chips: r.playerState.chipsRemainingOnMap,
        ticks: r.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(400, r.buttonPressCtx.moveBoundary),
      };
    }
    prev = rec.tick;
  }
  return {
    parity,
    withWaits,
    i,
    completed: r.completed,
    died: r.playerDied,
    chips: r.playerState.chipsRemainingOnMap,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(400, r.buttonPressCtx.moveBoundary),
  };
}

for (const p of ["even", "odd"] as const) {
  for (const w of [false, true]) {
    console.log(replay(p, w));
  }
}
