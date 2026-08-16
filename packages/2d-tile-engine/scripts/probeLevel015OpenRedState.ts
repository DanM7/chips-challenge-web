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
  label: string;
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

const start = apply(saved.letters);
console.log("label", saved.label, {
  pos: [start.gx, start.gy],
  chips: start.playerState.chipsRemainingOnMap,
  keys: start.playerState.keys,
  tools: start.playerState.tools,
});
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++)
    if (getCompositeTile(start.level, x, y) === "block_movable") console.log("block", x, y);
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const c = getCompositeTile(start.level, x, y);
    if (String(c).startsWith("key_")) console.log("key", x, y, c);
  }

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function k(r: Runner) {
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${r.playerState.keys.join("+")}|${r.playerState.tools.join("+")}`;
}
const q = [start];
const seen = new Set([k(start)]);
let qi = 0;
const hits: string[] = [];
while (qi < q.length && qi < 100000) {
  const r = q[qi++]!;
  if (r.playerState.chipsRemainingOnMap <= 2 && r.playerState.keys.includes("key_blue"))
    hits.push(`c2b @${r.gx},${r.gy}`);
  if (r.gx === 18 && r.gy === 20) hits.push(`blue tile chips=${r.playerState.chipsRemainingOnMap}`);
  if (r.playerState.chipsRemainingOnMap < 3) hits.push(`c${r.playerState.chipsRemainingOnMap} @${r.gx},${r.gy} keys=${r.playerState.keys}`);
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
console.log("seen", seen.size, "unique hits", [...new Set(hits)].slice(0, 25));
