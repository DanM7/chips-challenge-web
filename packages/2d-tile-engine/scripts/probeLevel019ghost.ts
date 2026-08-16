import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { direction: number }[] };
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const LETTER: Record<string, string> = { up: "U", left: "L", down: "D", right: "R" };
const dirs = sol.twsRecords
  .map((r) => TWS_DIR[r.direction])
  .filter((d): d is Direction => !!d);

// Ghost replay: ignore teeth entirely
const r = createMsCc1SimulationRunner(structuredClone(level));
r.buttonPressCtx.stepParity = "odd";
r.buttonPressCtx.chipIgnoresTeeth = true;
// Also remove monsters so Chip doesn't die walking onto them
r.monsters.forEach((m) => {
  m.alive = false;
});

const milestones: number[] = [28, 50, 63, 69, 80, 100, 150, 200, 250, 300, 346];
for (let i = 0; i < dirs.length; i++) {
  const before = `${r.gx},${r.gy}`;
  const moved = !stepMsCc1Simulation(r, dirs[i]!);
  // step returns true when ended; with no monsters shouldn't end unless exit
  void moved;
  // Actually stepMsCc1Simulation returns true when run ends
  if (milestones.includes(i + 1) || r.completed || (i < 80 && (i + 1) % 10 === 0)) {
    console.log(
      `#${i + 1} ${LETTER[dirs[i]!]} ${before}->${r.gx},${r.gy} tile=${getCompositeTile(r.level, r.gx, r.gy)} chips=${r.playerState.chipsRemainingOnMap} done=${r.completed}`,
    );
  }
  if (r.completed) {
    console.log("WIN rem", msSecondsRemaining(210, r.buttonPressCtx.moveBoundary), "ticks", r.buttonPressCtx.moveBoundary);
    break;
  }
}
console.log("final", r.gx, r.gy, "chips", r.playerState.chipsRemainingOnMap, "completed", r.completed, "moves", r.chipMoves);

// Compare SW-like opening positions
function expand(route: string): Direction[] {
  const out: Direction[] = [];
  const re = /(\d+)?([UDLR])/g;
  let m: RegExpExecArray | null;
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  while ((m = re.exec(route.replace(/\s/g, ""))) !== null) {
    const n = m[1] ? Number(m[1]) : 1;
    for (let i = 0; i < n; i++) out.push(map[m[2]!]!);
  }
  return out;
}

function posAfter(route: string) {
  const rr = createMsCc1SimulationRunner(structuredClone(level));
  rr.monsters.forEach((m) => {
    m.alive = false;
  });
  for (const d of expand(route)) stepMsCc1Simulation(rr, d);
  return `${rr.gx},${rr.gy} chips=${rr.playerState.chipsRemainingOnMap}`;
}

console.log("TWS open 11D8R9U", posAfter("11D8R9U"));
console.log("SW open 11D9R8U", posAfter("11D9R8U"));
console.log("TWS through 11D8R9U6L3D3U11R", posAfter("11D8R9U6L3D3U11R"));
console.log("SW through 11D9R8U6L2D3U11R", posAfter("11D9R8U6L2D3U11R"));
