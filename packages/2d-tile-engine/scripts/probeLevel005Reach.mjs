import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";

const dirs = ["up", "down", "left", "right"];
const WAIT = "__wait__";
const actions = [...dirs, WAIT];

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

function reach(gx, gy, maxDepth) {
  const q = [{ seq: [], r: createMsCc1SimulationRunner(structuredClone(level)) }];
  const seen = new Set([msCc1RunnerStateKey(q[0].r)]);
  while (q.length) {
    const f = q.shift();
    if (f.r.gx === gx && f.r.gy === gy) return f.seq;
    if (f.seq.length >= maxDepth || f.r.playerDied) continue;
    for (const a of actions) {
      const r = cloneMsCc1SimulationRunner(f.r);
      if (a === WAIT) stepMsCc1Wait(r);
      else stepMsCc1Simulation(r, a);
      if (r.playerDied) continue;
      const k = msCc1RunnerStateKey(r);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, a], r });
    }
  }
  return null;
}

for (const [x, y] of [
  [16, 13],
  [19, 13],
  [20, 13],
  [14, 19],
  [11, 19],
]) {
  const s = reach(x, y, 20);
  console.log(`(${x},${y})`, s ? s.length : "NO");
}
