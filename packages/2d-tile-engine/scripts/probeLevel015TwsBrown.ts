import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const tws = JSON.parse(readFileSync("integration/data/cc1-ms-solutions/level-015.json", "utf8")) as {
  moves: string[];
};

const r = createMsCc1SimulationRunner(structuredClone(level));
let prevBrown = getCompositeTile(r.level, 16, 9);
let prevTrap = false;
for (let i = 0; i < tws.moves.length; i++) {
  const ch = tws.moves[i]!;
  if (ch === "W") stepMsCc1Wait(r);
  else
    stepMsCc1Simulation(
      r,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
  const brown = getCompositeTile(r.level, 16, 9);
  const trap = isTrapOpen(r.buttonPressCtx, 16, 16);
  let block = "";
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") block = `${x},${y}`;
  if (brown !== prevBrown || trap !== prevTrap || (brown === "block_movable" && i % 5 === 0)) {
    console.log(i, {
      pos: [r.gx, r.gy],
      brown,
      trap,
      block,
      chips: r.playerState.chipsRemainingOnMap,
      keys: r.playerState.keys,
      rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
      done: r.completed,
    });
  }
  prevBrown = brown;
  prevTrap = trap;
  if (r.completed) {
    console.log("DONE", i, msSecondsRemaining(250, r.buttonPressCtx.moveBoundary), "block", block, "brown", brown, "trap", trap);
    break;
  }
}
