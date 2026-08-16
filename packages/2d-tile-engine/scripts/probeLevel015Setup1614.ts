import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of saved.letters) {
  if (ch === "W") stepMsCc1Wait(start);
  else
    stepMsCc1Simulation(
      start,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
}

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function blockPos(r: Runner) {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "none";
}

const q = [start];
const seen = new Set([`${start.gx},${start.gy}|${blockPos(start)}`]);
let qi = 0;
while (qi < q.length && qi < 100000) {
  const r = q[qi++]!;
  if (blockPos(r) === "16,14") {
    console.log("block 16,14 chip", [r.gx, r.gy], "trap", isTrapOpen(r.buttonPressCtx, 16, 16));
    // from here can we reach 16,15?
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}|${blockPos(n)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    q.push(n);
  }
}

// specifically find block 16,14 and chip 16,15
qi = 0;
const q2 = [start];
const seen2 = new Set([`${start.gx},${start.gy}|${blockPos(start)}`]);
let found = false;
while (qi < q2.length && qi < 200000) {
  const r = q2[qi++]!;
  if (blockPos(r) === "16,14" && r.gx === 16 && r.gy === 15) {
    found = true;
    console.log("FOUND setup");
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}|${blockPos(n)}`;
    if (seen2.has(k)) continue;
    seen2.add(k);
    q2.push(n);
  }
}
console.log("setup found", found, "seen2", seen2.size);

// list all chip positions when block at 16,14
const chips = new Set<string>();
for (const key of seen2) {
  if (key.includes("|16,14")) chips.add(key.split("|")[0]!);
}
console.log("chip positions with block 16,14", [...chips].sort().join(" "));
