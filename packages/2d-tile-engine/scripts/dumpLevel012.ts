import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { createMsCc1SimulationRunner } from "../engine/msCc1/msCc1Simulation.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-012.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const r = createMsCc1SimulationRunner(structuredClone(level));
console.log({
  start: `${r.gx},${r.gy}`,
  chipsReq: level.chipsRequired,
  chipsOnMap: r.playerState.chipsRemainingOnMap,
  monsters: r.monsters.map((m) => ({
    t: (m as { type?: string }).type ?? (m as { kind?: string }).kind,
    x: m.x,
    y: m.y,
    d: m.direction,
  })),
  playerStart: level.playerStart,
});

// Print ASCII of interesting tiles
const W = level.width;
const H = level.height;
const upper = level.layers.upper as string[];
for (let y = 0; y < H; y++) {
  let row = "";
  for (let x = 0; x < W; x++) {
    const t = upper[y * W + x] ?? "empty";
    if (t === "wall") row += "#";
    else if (t === "chip") row += "c";
    else if (t === "exit") row += "E";
    else if (t === "socket" || t === "chip_socket") row += "S";
    else if (t.includes("teeth")) row += "T";
    else if (t === "empty" || t === "floor") row += ".";
    else row += "?";
  }
  console.log(String(y).padStart(2, "0") + " " + row);
}
