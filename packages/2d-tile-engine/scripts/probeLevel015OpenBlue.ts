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
const seen = new Set([`${start.gx},${start.gy}|${start.playerState.keys.join("+")}|${blockPos(start)}|${cellTile(start.level, "upper", 16, 11)}`]);
let qi = 0;
let opened = false;
let brown = false;
while (qi < q.length && qi < 200000) {
  const r = q[qi++]!;
  if (!opened && cellTile(r.level, "upper", 16, 11) !== "door_blue") {
    opened = true;
    console.log("OPENED blue", [r.gx, r.gy], "block", blockPos(r), "keys", r.playerState.keys);
  }
  if (!brown && getCompositeTile(r.level, 16, 9) === "block_movable") {
    brown = true;
    console.log("BROWN", [r.gx, r.gy], "keys", r.playerState.keys);
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}|${n.playerState.keys.join("+")}|${blockPos(n)}|${cellTile(n.level, "upper", 16, 11)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    q.push(n);
  }
}
console.log("done opened", opened, "brown", brown, "seen", seen.size);

// Can we stand on 16,11?
qi = 0;
const q2 = [start];
const seen2 = new Set([`${start.gx},${start.gy}`]);
let atDoor = false;
while (qi < q2.length && qi < 50000) {
  const r = q2[qi++]!;
  if (r.gx === 16 && r.gy === 11) {
    atDoor = true;
    console.log("at 16,11 keys", r.playerState.keys, "tile", cellTile(r.level, "upper", 16, 11));
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}|${n.playerState.keys.join("+")}`;
    if (seen2.has(k)) continue;
    seen2.add(k);
    q2.push(n);
  }
}
console.log("reach 16,11", atDoor, "seen2", seen2.size);
