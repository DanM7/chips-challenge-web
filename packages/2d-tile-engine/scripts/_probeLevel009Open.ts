import { readFileSync } from "fs";
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
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirs: Direction[] = ["up", "down", "left", "right"];

function bfs(
  maxDepth: number,
  done: (r: ReturnType<typeof createMsCc1SimulationRunner>) => boolean,
) {
  const start = createMsCc1SimulationRunner(structuredClone(level));
  const q: { seq: Direction[]; runner: typeof start }[] = [{ seq: [], runner: start }];
  const seen = new Set([msCc1RunnerStateKey(start)]);
  let nodes = 0;
  while (q.length && nodes < 500_000) {
    const f = q.shift()!;
    nodes++;
    if (done(f.runner)) return { seq: f.seq, runner: f.runner, nodes };
    if (f.runner.playerDied || f.seq.length >= maxDepth) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before || seen.has(after)) continue;
      seen.add(after);
      q.push({ seq: [...f.seq, d], runner: next });
    }
  }
  return null;
}

const yellow = bfs(40, (r) => r.playerState.keys.some((k) => k.includes("yellow")));
console.log(
  "yellow",
  yellow && {
    seq: yellow.seq.map((d) => d[0]!.toUpperCase()).join(""),
    pos: `${yellow.runner.gx},${yellow.runner.gy}`,
    nodes: yellow.nodes,
  },
);

const chip = bfs(20, (r) => r.playerState.chipsRemainingOnMap < 9);
console.log(
  "first chip",
  chip && {
    seq: chip.seq.map((d) => d[0]!.toUpperCase()).join(""),
    pos: `${chip.runner.gx},${chip.runner.gy}`,
    chips: chip.runner.playerState.chipsRemainingOnMap,
  },
);

// Manual probe: GameFAQs opener
const letters = "RRRR".split("");
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of letters) {
  const d = ({ U: "up", D: "down", L: "left", R: "right" } as const)[ch]!;
  stepMsCc1Simulation(r, d);
  console.log(ch, r.gx, r.gy, getCompositeTile(r.level, r.gx, r.gy), "chips", r.playerState.chipsRemainingOnMap, "died", r.playerDied);
}
