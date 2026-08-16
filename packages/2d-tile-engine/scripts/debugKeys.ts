import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirMap: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};

const route = "LLUULLLDURRRDDDRRRDDDDDUUUULURRUU";
const runner = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of route) {
  stepMsCc1Simulation(runner, dirMap[ch]!);
}
console.log("pos", runner.gx, runner.gy);
console.log("keys", runner.playerState.keys);
console.log("tile 17,13", getCompositeTile(runner.level, 17, 13));
console.log("tile 17,15", getCompositeTile(runner.level, 17, 15));
