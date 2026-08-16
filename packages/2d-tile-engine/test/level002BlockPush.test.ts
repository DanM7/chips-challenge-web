import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it } from "vitest";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelPath = path.join(
  __dirname,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
);

function loadLevel(): LevelData {
  const level = JSON.parse(fs.readFileSync(levelPath, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function dumpArea(runner: ReturnType<typeof createMsCc1SimulationRunner>) {
  for (let y = 10; y <= 14; y++) {
    let row = "";
    for (let x = 14; x <= 24; x++) {
      const u = getCompositeTile(runner.level, x, y).slice(0, 5).padEnd(5);
      const l = cellTile(runner.level, "lower", x, y) === "water" ? "~" : ".";
      row += `${u}${l} `;
    }
    console.log(y, row);
  }
}

function play(moves: Direction[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(loadLevel()));
  for (const d of moves) {
    const bx = runner.gx;
    const by = runner.gy;
    stepMsCc1Simulation(runner, d);
    const moved = runner.gx !== bx || runner.gy !== by;
    console.log(d, moved ? `${bx},${by}->${runner.gx},${runner.gy}` : "BLOCKED", "chips", runner.playerState.chipsRemainingOnMap);
    if (runner.playerDied) break;
  }
  return runner;
}

describe("level 002 block push probe", () => {
  it("east chips then push blocks north/west", () => {
    const east: Direction[] = ["up", "right", "right", "down", "down"];
    console.log("\n--- after east chips ---");
    const r1 = play(east);
    dumpArea(r1);

    console.log("\n--- push sequence A ---");
    const r2 = play([
      ...east,
      "left",
      "left",
      "left",
      "up",
      "up",
      "left",
      "down",
      "right",
      "up",
      "left",
      "left",
      "up",
      "up",
      "right",
      "right",
      "down",
      "down",
      "left",
      "up",
      "left",
      "left",
      "left",
      "up",
      "right",
      "up",
      "right",
      "down",
      "down",
      "left",
      "left",
      "left",
      "down",
      "right",
      "right",
      "up",
      "left",
      "left",
      "left",
      "left",
      "up",
      "up",
      "up",
      "up",
      "up",
      "left",
      "left",
      "left",
      "left",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "right",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "left",
      "left",
      "left",
      "left",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "up",
      "up",
      "left",
      "left",
      "left",
      "left",
      "left",
      "left",
      "left",
      "left",
    ]);
    console.log("final", r2.gx, r2.gy, "chips", r2.playerState.chipsRemainingOnMap, "win", r2.completed);
    dumpArea(r2);
  });
});
