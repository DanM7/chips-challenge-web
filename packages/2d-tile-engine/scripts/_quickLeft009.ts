import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
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
function apply(r: ReturnType<typeof createMsCc1SimulationRunner>, seq: Act[]): void {
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.playerDied) break;
  }
}

const PREFIX =
  "RRRRLLDDDDUUUURRRRRRUURRRDRUUUDDDLLDRDRUUUUUUDDDLLLLDRRRDRUUUUUUDDDDDLLLLDRRRDRUUUUUUUUUDDDDDRRURRDLULDRULDR" +
  "RDLULUUUDUUUUUUUUUUUDUDDDDDLLLLRRRRDDDDDDUUUULLLLRRRRDWDDDUUUUUURRRRLLLLDDDDRRRRRRUURULLDDLLLLLDDDDLLDDRRDRRURRUULUU";

const r = createMsCc1SimulationRunner(structuredClone(level));
apply(r, expand(PREFIX));
console.log("start", r.gx, r.gy, r.playerState.chipsRemainingOnMap, r.playerDied);

const dirs: Direction[] = ["up", "down", "left", "right"];
type N = { seq: Direction[]; r: ReturnType<typeof createMsCc1SimulationRunner> };
const q: N[] = [{ seq: [], r: cloneMsCc1SimulationRunner(r) }];
const seen = new Set([`${r.gx},${r.gy}`]);
let nodes = 0;
let found: N | null = null;
while (q.length && nodes < 300_000) {
  const f = q.shift()!;
  nodes++;
  if (f.r.gx === 3 && f.r.gy === 20) {
    found = f;
    break;
  }
  if (f.seq.length >= 60) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.r);
    const bx = n.gx;
    const by = n.gy;
    stepMsCc1Simulation(n, d);
    if (n.playerDied || (n.gx === bx && n.gy === by)) continue;
    const k = `${n.gx},${n.gy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    q.push({ seq: [...f.seq, d], r: n });
  }
}
console.log(
  "found",
  found && found.seq.map((d) => d[0]!.toUpperCase()).join(""),
  "nodes",
  nodes,
  "chips",
  found?.r.playerState.chipsRemainingOnMap,
  "seen",
  seen.size,
);
