import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const saved = JSON.parse(readFileSync(".tmp/level015-bold-letters.json", "utf8")) as {
  letters: string[];
};

function apply(letters: string[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
  }
  return r;
}

const start = apply(saved.letters);
console.log("start", {
  pos: [start.gx, start.gy],
  chips: start.playerState.chipsRemainingOnMap,
  keys: start.playerState.keys,
  tools: start.playerState.tools,
});

// keys on map
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const c = getCompositeTile(start.level, x, y);
    if (String(c).startsWith("key_")) console.log("mapkey", x, y, c);
  }

// doors
for (const y of [11, 15])
  for (const x of [12, 14, 16, 18, 20])
    console.log(`door ${x},${y}`, cellTile(start.level, "upper", x, y));

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function key(r: Runner) {
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${r.playerState.keys.join("+")}|${r.playerState.tools.join("+")}`;
}
const q = [start];
const seen = new Set([key(start)]);
let qi = 0;
let bestChips = start.playerState.chipsRemainingOnMap;
const interesting: string[] = [];
while (qi < q.length && qi < 80000) {
  const r = q[qi++]!;
  if (r.playerState.chipsRemainingOnMap < bestChips) {
    bestChips = r.playerState.chipsRemainingOnMap;
    interesting.push(`chips${bestChips} @${r.gx},${r.gy} keys=${r.playerState.keys.join("+")}`);
  }
  if (r.playerState.keys.includes("key_blue") && r.playerState.chipsRemainingOnMap <= 2)
    interesting.push(`blue+c2 @${r.gx},${r.gy} keys=${r.playerState.keys.join("+")}`);
  if (r.gx === 18 && r.gy === 20) interesting.push(`at blue key tile chips=${r.playerState.chipsRemainingOnMap} keys=${r.playerState.keys}`);
  if (r.gx === 30 && r.gy === 25) interesting.push(`at3025 chips=${r.playerState.chipsRemainingOnMap}`);
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = key(n);
    if (seen.has(k)) continue;
    seen.add(k);
    q.push(n);
  }
}
console.log("seen", seen.size, "bestChips", bestChips);
console.log([...new Set(interesting)].slice(0, 40));
