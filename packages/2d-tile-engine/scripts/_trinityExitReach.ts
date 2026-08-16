import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-011.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const letters =
  "DLLLDULLUULLUULLUURDLDRRDDRRDDRRRDDDDDDDLDDRRDDRRURDLLLUULLUURUUUUUUURRRRRRRRRRRUUULLDDLLUUUURRURDLLLDDDDRRUURRDDDLLLLLLLLLDDUUUUUUUUUUUUUUUUUUULLLLLLLLLLLLLLRRRRRRRRRRRRRRDDDDDDDDDDDDDDDLLLLRRUUUUUUUUUUUUULLLLLLLLLLLLRRRRRRRRRRRRDDDDDDDDDDDDDRRRRRRLLUUUUUUUUUUUUURRRRRRRRRRRR";
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const a of decodeSolutionMoves([...letters])) {
  if (a === "wait") stepMsCc1Wait(r);
  else stepMsCc1Simulation(r, a as Direction);
}
console.log("end", `${r.gx},${r.gy}`, "chips", r.playerState.chipsRemainingOnMap, "died", r.playerDied, "done", r.completed);

const special: string[] = [];
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const t = getCompositeTile(r.level, x, y);
    if (t === "exit" || t === "socket" || t === "chip") special.push(`${x},${y}:${t}`);
  }
console.log("special", special);

const dirs: Direction[] = ["up", "down", "left", "right"];
const q = [cloneMsCc1SimulationRunner(r)];
const seen = new Set([`${r.gx},${r.gy}`]);
let qi = 0;
const pos: string[] = [];
while (qi < q.length && qi < 20000) {
  const f = q[qi++]!;
  pos.push(`${f.gx},${f.gy}`);
  if (f.completed) {
    console.log("FOUND EXIT via reach", `${f.gx},${f.gy}`);
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    q.push(n);
  }
}
console.log("reachable cells", seen.size, [...seen].sort().join(" "));
console.log("contains 30,24", seen.has("30,24"), "29,1", seen.has("29,1"), "15,16", seen.has("15,16"));
