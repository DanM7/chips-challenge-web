import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
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
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of saved.letters) {
  if (ch === "W") stepMsCc1Wait(r);
  else
    stepMsCc1Simulation(
      r,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
}
const chips: unknown[] = [];
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const u = cellTile(r.level, "upper", x, y);
    const l = cellTile(r.level, "lower", x, y);
    const c = getCompositeTile(r.level, x, y);
    if (
      String(u).includes("chip") ||
      String(l).includes("chip") ||
      String(c).includes("chip")
    )
      chips.push({ x, y, u, l, c });
  }
console.log(JSON.stringify({ chipsRemaining: r.playerState.chipsRemainingOnMap, chips }, null, 2));

// Fresh level chips
const fresh = createMsCc1SimulationRunner(structuredClone(level));
const freshChips: unknown[] = [];
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const u = cellTile(fresh.level, "upper", x, y);
    const l = cellTile(fresh.level, "lower", x, y);
    if (u === "computer_chip" || l === "computer_chip") freshChips.push({ x, y, u, l });
  }
console.log("fresh chips", freshChips.length, fresh.playerState.chipsRemainingOnMap);
console.log(JSON.stringify(freshChips, null, 2));
