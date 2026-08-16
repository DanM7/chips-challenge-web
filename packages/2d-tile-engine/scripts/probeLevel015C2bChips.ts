import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
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

function apply(letters: string[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
  }
  return r;
}

const r = apply(saved.letters);
console.log({
  pos: [r.gx, r.gy],
  chips: r.playerState.chipsRemainingOnMap,
  keys: r.playerState.keys,
  tools: r.playerState.tools,
});
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const u = cellTile(r.level, "upper", x, y);
    if (u === "chip" || u === "computer_chip") console.log("chip", x, y);
  }
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++)
    if (getCompositeTile(r.level, x, y) === "block_movable") console.log("block", x, y);

// simple reachability to chips0
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
const q: Runner[] = [r];
const seen = new Set<string>();
const k = (x: Runner) =>
  `${x.gx},${x.gy}|${x.playerState.chipsRemainingOnMap}|${x.playerState.keys.join("+")}|${x.playerState.tools.join("+")}`;
seen.add(k(r));
let qi = 0;
let best = 2;
while (qi < q.length && qi < 100000) {
  const cur = q[qi++]!;
  if (cur.playerState.chipsRemainingOnMap < best) {
    best = cur.playerState.chipsRemainingOnMap;
    console.log("best", best, [cur.gx, cur.gy], "keys", cur.playerState.keys);
  }
  if (cur.playerState.chipsRemainingOnMap === 0) {
    console.log("CHIPS0", [cur.gx, cur.gy]);
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(cur);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const key = k(n);
    if (seen.has(key)) continue;
    seen.add(key);
    q.push(n);
  }
}
console.log("seen", seen.size, "best", best);
