import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
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

function apply(r: ReturnType<typeof createMsCc1SimulationRunner>, seq: Direction[]): void {
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied) break;
  }
}

function water(l: LevelData): number {
  let n = 0;
  for (let y = 20; y <= 23; y++) if (getCompositeTile(l, 16, y) === "water") n++;
  return n;
}

function blocks(r: ReturnType<typeof createMsCc1SimulationRunner>): string {
  const b: string[] = [];
  for (let y = 19; y <= 28; y++) {
    for (let x = 11; x <= 17; x++) {
      if (getCompositeTile(r.level, x, y) === "block_movable") b.push(`${x},${y}`);
    }
  }
  return b.join(" ");
}

const base = createMsCc1SimulationRunner(structuredClone(level));
apply(base, expand("4R2L4D4U5RRUURRRDRUU"));
console.log("base", base.gx, base.gy, "w", water(base.level), blocks(base));

const manuals = [
  "4DL5ULUR",
  "4DL4ULUR",
  "4DL6ULUR",
  "4DL5ULUUR",
  "DDDDLUUUUULUR",
  "DDDDLUUUULUR",
  "DDDDLUUUUUR",
  "4DL5U2LUR",
  "4DL5ULDRUR",
  "LDDDDRUUUUULUR",
  "4DL5U L 2D R 2U R",
  "4DL5UL2UR",
  "4DL5U2DRUR",
  // step by step debug 4D L
  "4DL",
  "4DLU",
  "4DL2U",
  "4DL3U",
  "4DL4U",
  "4DL5U",
  "4DL5UL",
  "4DL5ULU",
  "4DL5ULUR",
];

for (const m of manuals) {
  const t = cloneMsCc1SimulationRunner(base);
  apply(t, expand(m));
  console.log(
    m.padEnd(20),
    `pos=${t.gx},${t.gy}`,
    `w=${water(t.level)}`,
    `died=${t.playerDied}`,
    t.deathMessage ?? "",
    `blocks=${blocks(t)}`,
  );
}
