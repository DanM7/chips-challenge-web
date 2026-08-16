import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
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
let r = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of saved.letters) {
  if (ch === "W") stepMsCc1Wait(r);
  else
    stepMsCc1Simulation(
      r,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
}

// BFS to (17,16) with block at 16,14
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function blockPos(r: Runner) {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "none";
}
const q = [r];
const seen = new Set([`${r.gx},${r.gy}|${blockPos(r)}`]);
let qi = 0;
let at = null as Runner | null;
while (qi < q.length) {
  const cur = q[qi++]!;
  if (blockPos(cur) === "16,14" && cur.gx === 17 && cur.gy === 16) {
    at = cur;
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(cur);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}|${blockPos(n)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    q.push(n);
  }
}
console.log("at 17,16 block16,14", !!at, at && { tools: at.playerState.tools, trap: isTrapOpen(at.buttonPressCtx, 16, 16) });
if (at) {
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(at);
    stepMsCc1Simulation(n, d);
    console.log("try", d, {
      pos: [n.gx, n.gy],
      died: n.playerDied,
      tile: getCompositeTile(n.level, n.gx, n.gy),
    });
  }
}

// Can we reach 17,16 at all?
qi = 0;
const q2 = [r];
const seen2 = new Set([`${r.gx},${r.gy}|${blockPos(r)}`]);
let hit1716 = false;
while (qi < q2.length && qi < 50000) {
  const cur = q2[qi++]!;
  if (cur.gx === 17 && cur.gy === 16) {
    hit1716 = true;
    console.log("reached 17,16 block", blockPos(cur));
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(cur);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}|${blockPos(n)}`;
    if (seen2.has(k)) continue;
    seen2.add(k);
    q2.push(n);
  }
}
console.log("any 17,16", hit1716);
