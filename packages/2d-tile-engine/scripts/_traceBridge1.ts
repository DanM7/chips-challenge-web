import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
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

const r = createMsCc1SimulationRunner(structuredClone(level));
const seq = expand("4R2L4D4U5RRUURRRDRUU");
for (const d of seq) {
  const before = `${r.gx},${r.gy}`;
  stepMsCc1Simulation(r, d);
  const blocks: string[] = [];
  for (let y = 19; y <= 28; y++) {
    for (let x = 11; x <= 17; x++) {
      if (getCompositeTile(r.level, x, y) === "block_movable") blocks.push(`${x},${y}`);
    }
  }
  console.log(
    d[0]!.toUpperCase(),
    `${before}->${r.gx},${r.gy}`,
    getCompositeTile(r.level, r.gx, r.gy),
    "blocks",
    blocks.join(" "),
    "16,23",
    getCompositeTile(r.level, 16, 23),
  );
  if (r.playerDied) {
    console.log("DEAD", r.deathMessage);
    break;
  }
}
