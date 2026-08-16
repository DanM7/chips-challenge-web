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

const dirs: Direction[] = ["up", "down", "left", "right"];
type Act = Direction | "wait";

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

function letter(seq: Act[]): string {
  return seq.map((a) => (a === "wait" ? "W" : a[0]!.toUpperCase())).join("");
}

function key(r: MsCc1SimulationRunner): string {
  const b: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const t = getCompositeTile(r.level, x, y);
      if (t === "block_movable") b.push(`b${x},${y}`);
      if (t === "bomb") b.push(`o${x},${y}`);
      if (t === "chip") b.push(`c${x},${y}`);
      if (t === "block_blue_wall" || t === "block_blue_tile") b.push(`${t[6]}${x},${y}`);
    }
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${b.join(";")}`;
}

function bfs(
  start: MsCc1SimulationRunner,
  maxDepth: number,
  maxNodes: number,
  done: (r: MsCc1SimulationRunner) => boolean,
  wait = true,
): Act[] | null {
  type N = { seq: Act[]; r: MsCc1SimulationRunner };
  const q: N[] = [{ seq: [], r: cloneMsCc1SimulationRunner(start) }];
  const seen = new Set([key(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (done(f.r)) {
      console.log("ok", nodes, letter(f.seq), `->${f.r.gx},${f.r.gy} c=${f.r.playerState.chipsRemainingOnMap}`);
      return f.seq;
    }
    if (f.r.playerDied || f.seq.length >= maxDepth) continue;
    const acts: Act[] = wait ? [...dirs, "wait"] : [...dirs];
    for (const a of acts) {
      const n = cloneMsCc1SimulationRunner(f.r);
      if (a === "wait") stepMsCc1Wait(n);
      else stepMsCc1Simulation(n, a);
      if (n.playerDied) continue;
      const k = key(n);
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
  "RDLULUUUDUUUUUUUUUUUDUDDDDDLLLLRRRRDDDDDDUUUULLLLRRRRDWDDDUUUUUURRRRLLLLDDDDRRRRRRUUR" +
  "ULL" +
  "DDLLLLLDDDDLLDDRRDRRURRUULUU";

const r = createMsCc1SimulationRunner(structuredClone(level));
apply(r, expand(PREFIX));
console.log("start", r.gx, r.gy, "chips", r.playerState.chipsRemainingOnMap);

// Goal: chip at 3,20 (left room, fake blue)
{
  const seq = bfs(r, 80, 1_000_000, (x) => x.gx === 3 && x.gy === 20);
  if (seq) {
    apply(r, seq);
    console.log("at left chip cell", r.playerState.chipsRemainingOnMap);
  }
}

// Or reduce chips
{
  const before = r.playerState.chipsRemainingOnMap;
  const seq = bfs(r, 100, 1_500_000, (x) => x.playerState.chipsRemainingOnMap < before);
  console.log("next chip", seq && letter(seq));
}

// Block room entry
{
  const seq = bfs(r, 60, 500_000, (x) => x.gx >= 6 && x.gx <= 10 && x.gy >= 12 && x.gy <= 16);
  console.log("block room", seq && letter(seq), seq && `pos will apply`);
  if (seq) {
    apply(r, seq);
    console.log("in block room", r.gx, r.gy);
    for (let y = 12; y <= 18; y++) {
      let row = `${y}: `;
      for (let x = 4; x <= 14; x++) {
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
}
