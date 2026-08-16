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

function dump(r: ReturnType<typeof createMsCc1SimulationRunner>, label: string): void {
  const b: string[] = [];
  for (let y = 19; y <= 28; y++)
    for (let x = 11; x <= 17; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") b.push(`${x},${y}`);
  const col: string[] = [];
  for (let y = 19; y <= 24; y++) col.push(`${y}:${getCompositeTile(r.level, 16, y)}`);
  console.log(
    label,
    `pos=${r.gx},${r.gy} w=${water(r.level)} died=${r.playerDied}`,
    r.deathMessage ?? "",
    `blocks=${b.join(" ")}`,
    `col=${col.join(" ")}`,
  );
}

const base = createMsCc1SimulationRunner(structuredClone(level));
apply(base, expand("4R2L4D4U5RRUURRRDRUU"));
dump(base, "base");

const tries = [
  "4D2LURDR4U",
  "4D2LURDR3U",
  "4D2LURDR5U",
  "4D2LURDRUUUU",
  "4D2LU R D R U U U U",
  "4D2LURDRUURU",
  // get 15,27 onto col 16 then up
  "4D2LUR",
  "4D2LURDR",
  "4D2LURDRU",
  "4D2LURDR2U",
  "4D2LURDR3U",
  "4D2LURDR4U",
  // other block 14,26
  "2D2LURURURU",
  "2D2LU R U R U R U",
  "2L2D R U R U R U",
  "LLDDRUURUURUU",
  // block 13,27
  "4D3LURRDR4U",
  "4D3LU2RDR4U",
];

for (const t of tries) {
  const r = cloneMsCc1SimulationRunner(base);
  apply(r, expand(t));
  if (water(r.level) < 3 || r.playerDied || r.playerState.keys.length) {
    dump(r, "TRY " + t);
  } else {
    console.log("nochange", t, `pos=${r.gx},${r.gy} w=${water(r.level)}`);
  }
}
