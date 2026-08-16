import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const saved = JSON.parse(readFileSync(".tmp/level015-bold-letters.json", "utf8")) as {
  letters: string[];
};
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of saved.letters) {
  if (ch === "W") stepMsCc1Wait(start);
  else
    stepMsCc1Simulation(
      start,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
}
const dirs: Direction[] = ["up", "down", "left", "right"];
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const q: Runner[] = [start];
const seen = new Set<string>();
const k = (r: Runner) =>
  `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${r.playerState.keys.join("+")}|${r.playerState.tools.join("+")}`;
seen.add(k(start));
let qi = 0;
let found: Runner | null = null;
while (qi < q.length && qi < 150000) {
  const r = q[qi++]!;
  if (r.playerState.chipsRemainingOnMap <= 2 && r.playerState.keys.includes("key_blue")) {
    found = r;
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const key = k(n);
    if (seen.has(key)) continue;
    seen.add(key);
    q.push(n);
  }
}
console.log(
  JSON.stringify({
    found: !!found,
    pos: found && [found.gx, found.gy],
    keys: found?.playerState.keys,
    chips: found?.playerState.chipsRemainingOnMap,
    seen: seen.size,
  }),
);
