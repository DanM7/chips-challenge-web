import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  type MsCc1SimulationRunner,
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

type Act = Direction | "wait";
const dirs: Direction[] = ["up", "down", "left", "right"];

function expand(n: string): Act[] {
  const out: Act[] = [];
  const re = /(\d*)([UDLRW])/g;
  let m: RegExpExecArray | null;
  const s = n.replace(/\s+/g, "");
  while ((m = re.exec(s))) {
    const c = m[1] ? Number.parseInt(m[1], 10) : 1;
    const ch = m[2]!;
    for (let i = 0; i < c; i++)
      out.push(ch === "W" ? "wait" : ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right");
  }
  return out;
}

function apply(r: MsCc1SimulationRunner, seq: Act[]): void {
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
}

function L(seq: Act[]): string {
  return seq.map((a) => (a === "wait" ? "W" : a[0]!.toUpperCase())).join("");
}

function sk(r: MsCc1SimulationRunner): string {
  const p: string[] = [`${r.gx},${r.gy}`, `c${r.playerState.chipsRemainingOnMap}`];
  for (let y = 11; y <= 21; y++) {
    for (let x = 1; x <= 15; x++) {
      const t = getCompositeTile(r.level, x, y);
      if (t === "block_movable" || t === "bomb" || t === "chip") p.push(`${t[0]}${x},${y}`);
      if (t === "block_blue_tile" || t === "block_blue_wall") p.push(`${t}${x},${y}`);
    }
  }
  return p.join("|");
}

function bfs(
  start: MsCc1SimulationRunner,
  maxDepth: number,
  maxNodes: number,
  done: (r: MsCc1SimulationRunner) => boolean,
): Act[] | null {
  type N = { seq: Act[]; r: MsCc1SimulationRunner };
  const q: N[] = [{ seq: [], r: cloneMsCc1SimulationRunner(start) }];
  const seen = new Set([sk(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (done(f.r)) {
      console.log("ok", nodes, L(f.seq));
      return f.seq;
    }
    if (f.r.playerDied || f.seq.length >= maxDepth) continue;
    for (const a of [...dirs, "wait"] as Act[]) {
      const n = cloneMsCc1SimulationRunner(f.r);
      if (a === "wait") stepMsCc1Wait(n);
      else stepMsCc1Simulation(n, a);
      if (n.playerDied) continue;
      const k = sk(n);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, a], r: n });
    }
  }
  console.log("fail", nodes);
  return null;
}

const PREFIX =
  "RRRRLLDDDDUUUURRRRRRUURRRDRUUUDDDLLDRDRUUUUUUDDDLLLLDRRRDRUUUUUUDDDDDLLLLDRRRDRUUUUUUUUUDDDDDRRURRDLULDRULDR" +
  "RDLULUUUDUUUUUUUUUUUDUDDDDDLLLLRRRRDDDDDDUUUULLLLRRRRDWDDDUUUUUURRRRLLLLDDDDRRRRRRUURULLDDLLLLLDDDDLLDDRRDRRURRUULUU";

const r = createMsCc1SimulationRunner(structuredClone(level));
apply(r, expand(PREFIX));
console.log("at", r.gx, r.gy, "chips", r.playerState.chipsRemainingOnMap);

// Left chip via fake blue at 3,21
for (const path of [
  "DDDDDDRRRDDDLLLLLDD",
  "6D 3R 2D 5L 2D",
  "DDDDLLLDDDDLLLLDDDR",
  "7D5L3D2R",
  "DDDDDDLLLLLDDDR",
]) {
  const t = cloneMsCc1SimulationRunner(r);
  apply(t, expand(path));
  console.log(
    "try",
    path,
    `pos=${t.gx},${t.gy} chips=${t.playerState.chipsRemainingOnMap} died=${t.playerDied}`,
    t.deathMessage ?? "",
  );
}

const left = bfs(r, 70, 800_000, (x) => x.playerState.chipsRemainingOnMap <= 4 && (x.gx <= 5 || getCompositeTile(x.level, 3, 20) !== "chip"));
if (left) {
  apply(r, left);
  console.log("after left", r.gx, r.gy, r.playerState.chipsRemainingOnMap);
}

const blocks = bfs(r, 40, 400_000, (x) => x.gy >= 13 && x.gy <= 15 && x.gx >= 6 && x.gx <= 10);
if (blocks) {
  apply(r, blocks);
  console.log("blocks", r.gx, r.gy);
  for (let y = 12; y <= 18; y++) {
    let row = `${y}: `;
    for (let x = 5; x <= 14; x++) {
      if (x === r.gx && y === r.gy) {
        row += "C";
        continue;
      }
      const t = getCompositeTile(r.level, x, y);
      row +=
        t === "empty" || t === "gravel"
          ? "."
          : t === "wall"
            ? "#"
            : t === "block_movable"
              ? "B"
              : t === "bomb"
                ? "o"
                : t === "chip"
                  ? "*"
                  : t[0]!;
    }
    console.log(row);
  }
}

// SW: block1 R, then 3 and 4, chip, block 2, last R, bombs
for (const path of [
  "R",
  "R D L L D L",
  "RDL LD L",
  "RU",
  "R 2D 2L D L",
]) {
  const t = cloneMsCc1SimulationRunner(r);
  apply(t, expand(path));
  const bs: string[] = [];
  for (let y = 12; y <= 16; y++)
    for (let x = 5; x <= 14; x++)
      if (getCompositeTile(t.level, x, y) === "block_movable") bs.push(`${x},${y}`);
  console.log("push", path, `pos=${t.gx},${t.gy} blocks=${bs.join(" ")} died=${t.playerDied}`);
}
