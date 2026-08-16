import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it } from "vitest";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  simulateMsCc1AutoplayLevel,
  stepMsCc1Simulation,
  stepMsCc1Wait,
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

const eastChips: Direction[] = ["up", "right", "right", "down", "down"];
const dirs: Direction[] = ["up", "down", "left", "right"];

describe("level 002 BFS from east chips", () => {
  it("searches completing route from prefix state", () => {
    const level = loadLevel();
    const prefixRunner = createMsCc1SimulationRunner(structuredClone(level));
    for (let i = 0; i < eastChips.length; i += 1) {
      if (i > 0) stepMsCc1Wait(prefixRunner);
      stepMsCc1Simulation(prefixRunner, eastChips[i]!);
    }
    console.log("prefix end", prefixRunner.gx, prefixRunner.gy, "chips", prefixRunner.playerState.chipsRemainingOnMap);

    function applyMove(runner: typeof prefixRunner, dir: Direction, isFirst: boolean) {
      if (!isFirst) stepMsCc1Wait(runner);
      stepMsCc1Simulation(runner, dir);
    }

    type Frame = { moves: Direction[]; runner: typeof prefixRunner };
    const queue: Frame[] = [{ moves: [], runner: prefixRunner }];
    const seen = new Set<string>([msCc1RunnerStateKey(prefixRunner)]);
    const maxDepth = 100;
    let expanded = 0;
    let bestChips = prefixRunner.playerState.chipsRemainingOnMap;

    while (queue.length > 0 && expanded < 500_000) {
      const frame = queue.shift()!;
      expanded++;
      if (frame.runner.completed) {
        const full = [...eastChips, ...frame.moves];
        const autoplay = simulateMsCc1AutoplayLevel(structuredClone(level), full);
        console.log("SOLVED", full.length, "moves", "autoplay", autoplay.completed, JSON.stringify(full));
        return;
      }
      const chips = frame.runner.playerState.chipsRemainingOnMap;
      if (chips < bestChips) {
        bestChips = chips;
        console.log("best", bestChips, "depth", frame.moves.length, "pos", frame.runner.gx, frame.runner.gy);
      }
      if (frame.moves.length >= maxDepth || frame.runner.playerDied) continue;
      for (const dir of dirs) {
        const next = cloneMsCc1SimulationRunner(frame.runner);
        const before = msCc1RunnerStateKey(next);
        applyMove(next, dir, frame.moves.length === 0);
        if (next.playerDied) continue;
        const after = msCc1RunnerStateKey(next);
        if (after === before || seen.has(after)) continue;
        seen.add(after);
        queue.push({ moves: [...frame.moves, dir], runner: next });
      }
    }
    console.log("NO SOLVE from prefix", "expanded", expanded, "bestChips", bestChips);
  });
});
