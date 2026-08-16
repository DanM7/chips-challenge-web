import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

function expand(notation: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  for (const tok of notation.trim().split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLR])$/);
    if (!m) throw new Error(tok);
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i++) out.push(map[m[2]!]!);
  }
  return out;
}

function apply(r: MsCc1SimulationRunner, seq: Direction[]): void {
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.completed || r.playerDied) break;
  }
}

function dump(r: MsCc1SimulationRunner, label: string): void {
  const blocks: string[] = [];
  for (let y = 19; y <= 28; y++) {
    for (let x = 11; x <= 17; x++) {
      if (getCompositeTile(r.level, x, y) === "block_movable") blocks.push(`${x},${y}`);
    }
  }
  const water: string[] = [];
  for (let y = 19; y <= 24; y++) water.push(`${y}:${getCompositeTile(r.level, 16, y)}`);
  console.log(
    label,
    `pos=${r.gx},${r.gy}`,
    `tile=${getCompositeTile(r.level, r.gx, r.gy)}`,
    `died=${r.playerDied}`,
    r.deathMessage ?? "",
    `keys=${r.playerState.keys}`,
    `blocks=${blocks.join(" ")}`,
    `col16=${water.join(" ")}`,
  );
}

function mapAround(r: MsCc1SimulationRunner): void {
  for (let y = 19; y <= 28; y++) {
    let row = `${y}: `;
    for (let x = 11; x <= 17; x++) {
      if (x === r.gx && y === r.gy) {
        row += "C";
        continue;
      }
      const t = getCompositeTile(r.level, x, y);
      row +=
        t === "empty"
          ? "."
          : t === "wall"
            ? "#"
            : t === "block_movable"
              ? "B"
              : t === "water"
                ? "~"
                : t === "dirt"
                  ? "="
                  : t === "key_red"
                    ? "K"
                    : t[0]!;
    }
    console.log(row);
  }
}

const base = createMsCc1SimulationRunner(structuredClone(level));
apply(base, expand("4R 2L 4D 4U 5R"));
dump(base, "start-blocks");
mapAround(base);

const candidates = [
  // SW: block 2U, RDR, block4, three to water
  "R D R 2U R D R",
  "R D R 2U",
  "2R D L 2U",
  "R D R 2U 2D R D R",
  "R D R 2U D R D R U",
  // push nearest 2U then get block4 (15,25) into water
  "R D R 2U 2D 2R U R U R U",
  "R D R 2U 2D 2R 2U R U R U",
  "R D R 2U L D 2R U R 2U R U R U",
  // from prior BFS first bridge was RUURRRDRUU — combine with 2U first
  "R D R 2U 2D R U U R R R D R U U",
  "R 2U", // wrong direction push?
  "2R 2U",
  "D 2R 2U",
  "D 2R U R U",
  // Get to (13,28) and push
  "D 2R 2U",
  "D 2R 2U R D R",
  "D 2R 2U R D R 2U R U R U R U",
  "D 2R 2U R D R U R U R U R U R U",
  // After 2U block at 13,25 — push into water via right
  "D 2R 2U R U R U R U",
  "D 2R 2U R U 2R D R U R U",
  "D 2R 2U 2D 3R 3U R U",
  "D 2R 2U 2D 2R U 2R U R U R U",
];

for (const c of candidates) {
  const r = cloneMsCc1SimulationRunner(base);
  apply(r, expand(c));
  let waters = 0;
  for (let y = 20; y <= 23; y++) if (getCompositeTile(r.level, 16, y) === "water") waters++;
  const hasRed = r.playerState.keys.some((k) => k.includes("red"));
  if (r.playerDied || waters < 4 || hasRed) {
    dump(r, `TRY ${c} (w=${waters})`);
  }
}

// Systematic: from base, try short scripts that reduce water
console.log("\n--- short reduce-water search ---");
const dirs: Direction[] = ["up", "down", "left", "right"];
function waterN(level: LevelData): number {
  let n = 0;
  for (let y = 20; y <= 23; y++) if (getCompositeTile(level, 16, y) === "water") n++;
  return n;
}

type Node = { seq: Direction[]; r: MsCc1SimulationRunner };
const q: Node[] = [{ seq: [], r: cloneMsCc1SimulationRunner(base) }];
const seen = new Set<string>();
let found: Direction[] | null = null;
let nodes = 0;
while (q.length && nodes < 200_000) {
  const f = q.shift()!;
  nodes++;
  if (waterN(f.r.level) < 4) {
    found = f.seq;
    break;
  }
  if (f.seq.length >= 16) continue;
  for (const d of dirs) {
    const next = cloneMsCc1SimulationRunner(f.r);
    const bx = [...Array(32)].flatMap((_, y) =>
      [...Array(32)].map((_, x) => (getCompositeTile(next.level, x, y) === "block_movable" ? `${x},${y}` : "")),
    );
    stepMsCc1Simulation(next, d);
    if (next.playerDied) continue;
    const key = `${next.gx},${next.gy}|${[...Array(32)]
      .flatMap((_, y) =>
        [...Array(32)].flatMap((_, x) =>
          getCompositeTile(next.level, x, y) === "block_movable" ? [`${x},${y}`] : [],
        ),
      )
      .join(";")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    q.push({ seq: [...f.seq, d], r: next });
  }
}
console.log(
  "first water reduce",
  found && found.map((d) => d[0]!.toUpperCase()).join(""),
  "nodes",
  nodes,
  "seen",
  seen.size,
);
if (found) {
  const r = cloneMsCc1SimulationRunner(base);
  apply(r, found);
  dump(r, "first-bridge");
  mapAround(r);
}
