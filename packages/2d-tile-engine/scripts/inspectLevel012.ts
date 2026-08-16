import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { createMsCc1SimulationRunner, stepMsCc1Simulation } from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const upper = level.layers.upper as string[];
const W = level.width;
let chips = 0;
let sockets = 0;
let exits = 0;
const socketPos: string[] = [];
const exitPos: string[] = [];
for (let i = 0; i < upper.length; i++) {
  const t = upper[i]!;
  const x = i % W;
  const y = Math.floor(i / W);
  if (t === "chip") chips++;
  if (t === "socket" || t === "chip_socket") {
    sockets++;
    socketPos.push(`${x},${y}`);
  }
  if (t === "exit") {
    exits++;
    exitPos.push(`${x},${y}`);
  }
}
console.log({ chips, sockets, exits, socketPos, exitPos, chipsRequired: level.chipsRequired });

// Try StrategyWiki opening
function expand(notation: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  for (const tok of notation.split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLR])$/);
    if (!m) throw new Error(tok);
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i++) out.push(map[m[2]!]!);
  }
  return out;
}

const open = expand("U 12L 4U 3R 2D");
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of open) {
  stepMsCc1Simulation(r, d);
  if (r.playerDied) break;
}
console.log("after open", {
  pos: `${r.gx},${r.gy}`,
  chips: r.playerState.chipsRemainingOnMap,
  died: r.playerDied,
  monsters: r.monsters.map((m) => `${m.x},${m.y}:${m.direction}`),
});

// What's at 15,8?
console.log("tile at start neighbors:");
for (const [dx, dy] of [
  [0, 0],
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
]) {
  const x = 15 + dx!;
  const y = 8 + dy!;
  console.log(`  ${x},${y}`, upper[y * W + x]);
}
