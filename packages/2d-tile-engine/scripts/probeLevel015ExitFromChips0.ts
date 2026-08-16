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
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
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
  label: string;
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
console.log("start", saved.label, {
  pos: [start.gx, start.gy],
  chips: start.playerState.chipsRemainingOnMap,
  keys: start.playerState.keys,
  tools: start.playerState.tools,
  rem: msSecondsRemaining(250, start.buttonPressCtx.moveBoundary),
  d15: cellTile(start.level, "upper", 16, 15),
  d11: cellTile(start.level, "upper", 16, 11),
});

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function k(r: Runner) {
  let blk = "";
  for (const x of [15, 16, 17, 18, 19, 20])
    for (const y of [9, 10, 11, 12, 13, 14, 15])
      if (getCompositeTile(r.level, x, y) === "block_movable") blk += `${x},${y};`;
  return `${r.gx},${r.gy}|${r.playerState.keys.join("+")}|${r.playerState.tools.join("+")}|${blk}|${cellTile(r.level, "upper", 16, 15)}|${cellTile(r.level, "upper", 16, 11)}|${isTrapOpen(r.buttonPressCtx, 16, 16)}|${getCompositeTile(r.level, 16, 9)}`;
}

const q: Runner[] = [start];
const seen = new Set([k(start)]);
let qi = 0;
const hits: string[] = [];
const t0 = Date.now();
while (qi < q.length && qi < 300000) {
  const r = q[qi++]!;
  if (qi % 50000 === 0) console.log("…", qi, "ms", Date.now() - t0);
  if (r.completed) {
    hits.push(
      `EXIT rem=${msSecondsRemaining(250, r.buttonPressCtx.moveBoundary)} ticks=${r.buttonPressCtx.moveBoundary} brown=${getCompositeTile(r.level, 16, 9)} trap=${isTrapOpen(r.buttonPressCtx, 16, 16)} d=${qi}`,
    );
    break;
  }
  if (getCompositeTile(r.level, 16, 9) === "block_movable" && hits.length < 5)
    hits.push(`BROWN at ${r.gx},${r.gy} rem=${msSecondsRemaining(250, r.buttonPressCtx.moveBoundary)} keys=${r.playerState.keys}`);
  if (r.playerState.keys.includes("key_red") && hits.filter((h) => h.startsWith("RED")).length < 3)
    hits.push(`RED at ${r.gx},${r.gy} rem=${msSecondsRemaining(250, r.buttonPressCtx.moveBoundary)}`);
  if (cellTile(r.level, "upper", 16, 15) !== "door_red" && hits.filter((h) => h.startsWith("OPENR")).length < 2)
    hits.push(`OPENR at ${r.gx},${r.gy}`);
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const key = k(n);
    if (seen.has(key)) continue;
    seen.add(key);
    q.push(n);
  }
}
console.log("seen", seen.size, "qi", qi, "ms", Date.now() - t0);
console.log(hits);
