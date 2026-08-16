import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
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
console.log("start", [start.gx, start.gy], "chips", start.playerState.chipsRemainingOnMap, "keys", start.playerState.keys);

// Find chip tiles
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const u = cellTile(start.level, "upper", x, y);
    if (u === "chip" || u === "computer_chip") console.log("chip", x, y, u);
  }

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function key(r: Runner) {
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${r.playerState.keys.join("+")}|${r.playerState.tools.join("+")}`;
}

const q: { r: Runner; dist: number }[] = [{ r: start, dist: 0 }];
const seen = new Set([key(start)]);
let qi = 0;
const hits: string[] = [];
while (qi < q.length && qi < 100000) {
  const { r, dist } = q[qi++]!;
  if (r.playerState.chipsRemainingOnMap < 2)
    hits.push(`chips${r.playerState.chipsRemainingOnMap} @${r.gx},${r.gy} d=${dist} keys=${r.playerState.keys.join("+")} tools=${r.playerState.tools.length}`);
  if (r.gx === 16 && r.gy === 19) hits.push(`at1619 chips=${r.playerState.chipsRemainingOnMap} keys=${r.playerState.keys}`);
  if (r.gx === 13 && r.gy === 27) hits.push(`at1327 chips=${r.playerState.chipsRemainingOnMap} keys=${r.playerState.keys}`);
  if (r.playerState.chipsRemainingOnMap === 0) {
    hits.push(`CHIPS0 @${r.gx},${r.gy} d=${dist} keys=${r.playerState.keys.join("+")} rem=${msSecondsRemaining(250, r.buttonPressCtx.moveBoundary)}`);
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = key(n);
    if (seen.has(k)) continue;
    seen.add(k);
    q.push({ r: n, dist: dist + 1 });
  }
}
console.log("seen", seen.size, "hits", hits.slice(0, 30));
