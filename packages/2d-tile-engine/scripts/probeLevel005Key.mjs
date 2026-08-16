import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";

const dirs = ["up", "down", "left", "right"];

const level = JSON.parse(
  fs.readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

function segmentBfsChipOnly(start, maxDepth, done) {
  const q = [{ seq: [], runner: start }];
  const seen = new Set([msCc1RunnerStateKey(start)]);
  while (q.length) {
    const f = q.shift();
    if (done(f.runner)) return f.seq;
    if (f.seq.length >= maxDepth || f.runner.playerDied) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const b = msCc1RunnerStateKey(next);
      if (f.seq.length > 0) stepMsCc1Wait(next);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const k = msCc1RunnerStateKey(next);
      if (k === b || seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  return null;
}

let r = createMsCc1SimulationRunner(structuredClone(level));
const toggle = segmentBfsChipOnly(
  r,
  15,
  (x) => getCompositeTile(x.level, 16, 15) === "block_toggle_open",
);
console.log("toggle moves", toggle);
for (const d of toggle) {
  stepMsCc1Wait(r);
  stepMsCc1Simulation(r, d);
}

const key = segmentBfsChipOnly(r, 30, (x) => x.playerState.keys.includes("red"));
console.log("key", key);
