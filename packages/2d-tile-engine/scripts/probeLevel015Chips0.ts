import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
const r = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < 761; i++) stepMsCc1Simulation(r, tws[i]!);

console.log({
  pos: { x: r.gx, y: r.gy },
  keys: r.playerState.keys,
  tools: r.playerState.tools,
  chips: r.playerState.chipsRemainingOnMap,
});

console.log("doors/blocks/keys remaining:");
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    const t = getCompositeTile(r.level, x, y);
    if (
      t.startsWith("door") ||
      t === "block_movable" ||
      t === "socket" ||
      t === "button_brown" ||
      t === "trap" ||
      t === "exit" ||
      t === "thief"
    ) {
      console.log(t, x, y);
    }
  }
}

// What does TWS do after 761?
console.log("\nTWS after chips0:");
const r2 = cloneMsCc1SimulationRunner(r);
for (let i = 761; i < tws.length; i++) {
  const before = { x: r2.gx, y: r2.gy, tools: [...r2.playerState.tools], keys: [...r2.playerState.keys] };
  stepMsCc1Simulation(r2, tws[i]!);
  if (
    r2.gx !== before.x ||
    r2.gy !== before.y ||
    r2.playerState.tools.length !== before.tools.length ||
    r2.completed ||
    getCompositeTile(r2.level, 16, 9) === "block_movable"
  ) {
    console.log(i + 1, tws[i], {
      pos: { x: r2.gx, y: r2.gy },
      tools: r2.playerState.tools.length,
      keys: r2.playerState.keys,
      brown: getCompositeTile(r2.level, 16, 9),
      ticks: r2.buttonPressCtx.moveBoundary,
      done: r2.completed,
    });
  }
}
