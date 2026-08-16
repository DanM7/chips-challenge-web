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
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-004.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);
const prefix = JSON.parse(fs.readFileSync(path.join(__dirname, "level004-partial.json"), "utf8"));
const hub = ["right", "up", "right", "right", "right", "right", "up", "up", "up", "up", "left"];

function atHub() {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const m of [...prefix, ...hub]) stepMsCc1Simulation(r, m);
  return r;
}

function bfs(start, target, maxDepth, maxNodes) {
  const dirs = ["up", "down", "left", "right"];
  const q = [{ moves: [], runner: start }];
  const seen = new Set([msCc1RunnerStateKey(start)]);
  let n = 0;
  while (q.length && n < maxNodes) {
    const f = q.shift();
    n++;
    if (f.runner.gx === target[0] && f.runner.gy === target[1]) return { moves: f.moves, n };
    if (f.moves.length >= maxDepth || f.runner.playerDied) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const k = msCc1RunnerStateKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ moves: [...f.moves, d], runner: next });
    }
  }
  return null;
}

const start = atHub();
for (const [x, y, name] of [
  [5, 10, "btn1"],
  [11, 8, "btn2"],
  [5, 6, "btn3"],
  [11, 5, "chip"],
  [8, 9, "tank1"],
  [8, 5, "tank2"],
]) {
  const r = bfs(start, [x, y], 25, 80_000);
  console.log(name, x, y, r ? r.moves.length + " n=" + r.n : "no");
}
