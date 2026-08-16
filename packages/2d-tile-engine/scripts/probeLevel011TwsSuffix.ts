#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { replayTwsRecords } from "../engine/twsReplay.js";
import { readLevelSolution } from "../integration/solutionStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const levelsDir = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels",
);
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const dirs: Direction[] = ["up", "down", "left", "right"];

function loadLevel(): LevelData {
  const level = JSON.parse(
    fs.readFileSync(path.join(levelsDir, "level-011.json"), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function replayTwsPrefix(level: LevelData, records: { tick: number; direction: number }[]) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let prevTick = 0;
  for (const rec of records) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    const gap = Math.max(0, rec.tick - prevTick - 1);
    for (let i = 0; i < gap; i += 1) {
      if (stepMsCc1Wait(runner)) return runner;
    }
    if (stepMsCc1Wait(runner)) return runner;
    if (stepMsCc1Simulation(runner, dir)) return runner;
    prevTick = rec.tick;
  }
  return runner;
}

function bfsWithWaits(start: ReturnType<typeof createMsCc1SimulationRunner>, maxDepth: number, maxNodes: number) {
  const q: { seq: Direction[]; runner: ReturnType<typeof createMsCc1SimulationRunner> }[] = [{ seq: [], runner: start }];
  const seen = new Set<string>([msCc1RunnerStateKey(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes += 1;
    if (f.runner.completed) return { seq: f.seq, nodes };
    if (f.runner.playerDied || f.seq.length >= maxDepth) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      if (f.seq.length > 0) stepMsCc1Wait(next);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  return { seq: null, nodes };
}

const entry = readLevelSolution<{ twsRecords: { tick: number; direction: number }[] }>(11)!;
const level = loadLevel();
console.log("Replaying TWS prefix...");
const start = replayTwsPrefix(level, entry.twsRecords);
console.log("start", start.gx, start.gy, "chips", start.playerState.chipsRemainingOnMap, "tools", start.playerState.tools);
const { seq, nodes } = bfsWithWaits(start, 120, 2_000_000);
console.log({ nodes, suffixLen: seq?.length ?? null, completed: seq ? "found" : "none" });
