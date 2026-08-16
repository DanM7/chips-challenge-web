import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    new URL(
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    const t = getCompositeTile(level, x, y);
    if (t.includes("lock") || t.includes("key_red") || (t === "ice" && y >= 18)) {
      console.log(x, y, t);
    }
  }
}

function expand(n: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  const re = /(\d*)([UDLR])/g;
  let m: RegExpExecArray | null;
  const s = n.replace(/\s+/g, "");
  while ((m = re.exec(s))) {
    const c = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < c; i++) out.push(map[m[2]!]!);
  }
  return out;
}

const toRed =
  "RRRRLLDDDDUUUURRRRRRUURRRDRUUUDDDLLDRDRUUUUUUDDDLLLLDRRRDRUUUUUUDDDDDLLLLDRRRDRUUUUUUUUU";
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of expand(toRed)) stepMsCc1Simulation(r, d);
console.log("at red", r.gx, r.gy, getCompositeTile(r.level, r.gx, r.gy), r.playerState.keys);

// Explore reachable from here (simple BFS)
const dirs: Direction[] = ["up", "down", "left", "right"];
const q = [cloneMsCc1SimulationRunner(r)];
const seen = new Set([`${r.gx},${r.gy}`]);
const reach: string[] = [];
while (q.length && reach.length < 80) {
  const f = q.shift()!;
  reach.push(`${f.gx},${f.gy}:${getCompositeTile(f.level, f.gx, f.gy)}`);
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f);
    const bx = n.gx;
    const by = n.gy;
    stepMsCc1Simulation(n, d);
    if (n.playerDied || (n.gx === bx && n.gy === by)) continue;
    const k = `${n.gx},${n.gy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    q.push(n);
  }
}
console.log("reachable", reach.join(" | "));
