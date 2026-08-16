import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
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

// Replay to trap_open if labeled, else apply all
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of saved.letters) {
  if (ch === "W") stepMsCc1Wait(start);
  else
    stepMsCc1Simulation(
      start,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
}
console.log("start", {
  pos: [start.gx, start.gy],
  trap: isTrapOpen(start.buttonPressCtx, 16, 16),
  d11: cellTile(start.level, "upper", 16, 11),
  block: (() => {
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++)
        if (getCompositeTile(start.level, x, y) === "block_movable") return `${x},${y}`;
    return "none";
  })(),
});

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function blockPos(r: Runner) {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "none";
}
function k(r: Runner) {
  return `${r.gx},${r.gy}|${blockPos(r)}|${isTrapOpen(r.buttonPressCtx, 16, 16)}`;
}

const q = [start];
const seen = new Set([k(start)]);
let qi = 0;
const interesting: string[] = [];
while (qi < q.length && qi < 100000) {
  const r = q[qi++]!;
  const bp = blockPos(r);
  if (bp === "16,14" && r.gx === 16 && r.gy === 15)
    interesting.push("setup 16,14 + chip 16,15");
  if (bp === "16,13") interesting.push("block 16,13");
  if (bp === "16,12") interesting.push("block 16,12");
  if (bp === "16,11") interesting.push("block 16,11");
  if (bp === "16,10") interesting.push("block 16,10");
  if (bp === "16,9") interesting.push("BROWN");
  if (r.gx === 16 && r.gy === 15) interesting.push(`at1615 block=${bp}`);
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
console.log("seen", seen.size);
console.log([...new Set(interesting)].slice(0, 40));
