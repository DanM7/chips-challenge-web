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
      if (getCompositeTile(r.level, x, y) === "block_movable") return [x, y] as const;
  return null;
}

// First open blue door
const q1 = [start];
const seen1 = new Set<string>();
const k1 = (r: Runner) => `${r.gx},${r.gy}|${r.playerState.keys.join("+")}|${blockPos(r)}|${cellTile(r.level, "upper", 16, 11)}`;
seen1.add(k1(start));
let qi = 0;
let opened: Runner | null = null;
while (qi < q1.length) {
  const r = q1[qi++]!;
  if (cellTile(r.level, "upper", 16, 11) !== "door_blue") {
    opened = r;
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = k1(n);
    if (seen1.has(k)) continue;
    seen1.add(k);
    q1.push(n);
  }
}
console.log("opened", !!opened, opened && blockPos(opened));

if (!opened) process.exit(1);

const q2 = [opened];
const seen2 = new Set([k1(opened)]);
qi = 0;
const positions = new Set<string>();
while (qi < q2.length && qi < 200000) {
  const r = q2[qi++]!;
  const bp = blockPos(r);
  if (bp) {
    const s = bp.join(",");
    if (!positions.has(s)) {
      positions.add(s);
      console.log("block", s);
    }
    if (bp[0] === 16 && bp[1] === 9) {
      console.log("BROWN SUCCESS", [r.gx, r.gy]);
      break;
    }
    if (bp[0] === 16 && bp[1] === 10) console.log("on socket", [r.gx, r.gy]);
    if (bp[0] === 16 && bp[1] === 11) console.log("on doorcell", [r.gx, r.gy]);
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = k1(n);
    if (seen2.has(k)) continue;
    seen2.add(k);
    q2.push(n);
  }
}
console.log("positions", [...positions].sort(), "seen", seen2.size);
