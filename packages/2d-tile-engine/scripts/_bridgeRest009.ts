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

const dirs: Direction[] = ["up", "down", "left", "right"];

function expand(n: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  const re = /(\d*)([UDLR])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(n.replace(/\s+/g, "")))) {
    const c = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < c; i++) out.push(map[m[2]!]!);
  }
  return out;
}

function apply(r: MsCc1SimulationRunner, seq: Direction[]): void {
  for (const d of seq) {
    stepMsCc1Simulation(r, d);
    if (r.playerDied || r.completed) break;
  }
}

function blocksKey(r: MsCc1SimulationRunner): string {
  const b: string[] = [];
  for (let y = 19; y <= 28; y++) {
    for (let x = 11; x <= 17; x++) {
      if (getCompositeTile(r.level, x, y) === "block_movable") b.push(`${x},${y}`);
    }
  }
  return `${r.gx},${r.gy}|${b.join(";")}`;
}

function waterN(level: LevelData): number {
  let n = 0;
  for (let y = 20; y <= 23; y++) if (getCompositeTile(level, 16, y) === "water") n++;
  return n;
}

function dump(r: MsCc1SimulationRunner, label: string): void {
  console.log(label, `pos=${r.gx},${r.gy} water=${waterN(r.level)} key=${blocksKey(r)} died=${r.playerDied}`, r.deathMessage ?? "");
  for (let y = 19; y <= 28; y++) {
    let row = `${y}: `;
    for (let x = 11; x <= 17; x++) {
      if (x === r.gx && y === r.gy) {
        row += "C";
        continue;
      }
      const t = getCompositeTile(r.level, x, y);
      row += t === "empty" ? "." : t === "wall" ? "#" : t === "block_movable" ? "B" : t === "water" ? "~" : t === "dirt" ? "=" : t === "key_red" ? "K" : t[0]!;
    }
    console.log(row);
  }
}

function bfsWater(start: MsCc1SimulationRunner, maxDepth: number, maxNodes: number): Direction[] | null {
  const goal = waterN(start.level) - 1;
  const q: { seq: Direction[]; r: MsCc1SimulationRunner }[] = [
    { seq: [], r: cloneMsCc1SimulationRunner(start) },
  ];
  const seen = new Set([blocksKey(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (waterN(f.r.level) <= goal) {
      console.log("found", nodes, f.seq.map((d) => d[0]!.toUpperCase()).join(""));
      return f.seq;
    }
    if (f.seq.length >= maxDepth) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.r);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const k = blocksKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, d], r: next });
    }
  }
  console.log("fail", nodes, "seen", seen.size);
  return null;
}

const r = createMsCc1SimulationRunner(structuredClone(level));
apply(r, expand("4R 2L 4D 4U 5R R U U R R R D R U U"));
dump(r, "after-bridge-1");

// Try known-ish push scripts for remaining
const scripts = [
  "L 3D R U R U R U",
  "L 3D L D R 2U R U R U",
  "3D L L U R U R U R U",
  "D D D L L U R 2U R U R U",
  "3D 2L U R U R U R U",
  "3D 2L U R U R U R U R U",
  "2L 3D R 3U R U",
  "2L 3D R 2U R U R U",
  "L D L D R U R U R U R U",
  "3D L U R U R U R U",
  "3D 2L 2U R 2U R U",
  "LLDDD RUURUURUU",
  "LDDDRUURUURUU",
  "DDDLRUURUURUU",
  // get block 15,27 up then right into water
  "3D L U U U R U R U",
  "3D L 3U R U R U",
  "3D L 3U R 2U",
  "3D L 2U R U R U R U",
  // block 14,26
  "2L 2D R U R U R U",
  "2L 2D U R U R U R U",
  "2L 2D 2U R U R U",
  "2D 2L U R U R U R U",
];

for (const s of scripts) {
  const t = cloneMsCc1SimulationRunner(r);
  apply(t, expand(s));
  if (waterN(t.level) < 3 || t.playerDied || t.playerState.keys.length) {
    console.log(
      "SCR",
      s,
      `w=${waterN(t.level)} pos=${t.gx},${t.gy} died=${t.playerDied}`,
      t.deathMessage ?? "",
      "keys",
      t.playerState.keys,
    );
  }
}

console.log("\nBFS bridge-3...");
const seq = bfsWater(r, 50, 2_000_000);
if (seq) {
  apply(r, seq);
  dump(r, "after-bridge-2");
  console.log("\nBFS bridge-2...");
  const seq2 = bfsWater(r, 50, 2_000_000);
  if (seq2) {
    apply(r, seq2);
    dump(r, "after-bridge-3");
    console.log("\nBFS bridge-1...");
    const seq3 = bfsWater(r, 50, 2_000_000);
    if (seq3) {
      apply(r, seq3);
      dump(r, "after-bridge-4");
      // red key
      const red = bfsWater; // placeholder
      const q: { seq: Direction[]; r: MsCc1SimulationRunner }[] = [
        { seq: [], r: cloneMsCc1SimulationRunner(r) },
      ];
      const seen = new Set([blocksKey(r)]);
      let found: Direction[] | null = null;
      while (q.length) {
        const f = q.shift()!;
        if (f.r.playerState.keys.some((k) => k.includes("red"))) {
          found = f.seq;
          break;
        }
        if (f.seq.length >= 20) continue;
        for (const d of dirs) {
          const n = cloneMsCc1SimulationRunner(f.r);
          stepMsCc1Simulation(n, d);
          if (n.playerDied) continue;
          const k = blocksKey(n);
          if (seen.has(k)) continue;
          seen.add(k);
          q.push({ seq: [...f.seq, d], r: n });
        }
      }
      console.log("red", found && found.map((d) => d[0]!.toUpperCase()).join(""));
    }
  }
}
