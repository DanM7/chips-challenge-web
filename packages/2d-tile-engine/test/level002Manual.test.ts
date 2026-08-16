import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  simulateMsCc1AutoplayLevel,
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

function replay(moves: Direction[]) {
  const level = loadLevel();
  return simulateMsCc1AutoplayLevel(structuredClone(level), moves);
}

function logState(label: string, moves: Direction[]): void {
  const level = loadLevel();
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const m of moves) {
    stepMsCc1Simulation(runner, m);
  }
  console.log(label, {
    pos: [runner.gx, runner.gy],
    chips: runner.playerState.chipsRemainingOnMap,
    tile: getCompositeTile(runner.level, runner.gx, runner.gy),
  });
}

describe("level 002 manual route search", () => {
  it("logs chip and block positions", () => {
    const level = loadLevel();
    console.log("start", level.playerStart);
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const t = getCompositeTile(level, x, y);
        if (["chip", "block_movable", "water", "exit", "socket"].includes(t)) {
          console.log(t, x, y);
        }
      }
    }
  });

  it("tries walkthrough-style route", () => {
    // East chips, bridge blocks north into water, loop for far chips, exit west.
    const moves: Direction[] = [
      "up",
      "right",
      "right",
      "down",
      "right",
      "up",
      "up",
      "left",
      "up",
      "left",
      "left",
      "up",
      "right",
      "up",
      "up",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "left",
      "left",
      "left",
      "left",
      "left",
      "left",
      "left",
      "left",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "up",
      "right",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "down",
      "left",
      "left",
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
    ];
    logState("after guess", moves);
    const result = replay(moves);
    console.log("result", {
      completed: result.completed,
      died: result.playerDied,
      chips: result.finalPlayerState.chipsRemainingOnMap,
      pos: result.finalPosition,
    });
    expect(result.completed).toBe(true);
  });
});
