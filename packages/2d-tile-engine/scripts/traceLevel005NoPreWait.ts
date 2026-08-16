import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  readFileSync("./integration/data/cc1-ms-solutions/level-005.json", "utf8"),
) as { twsRecords: Array<{ tick: number; direction: number }> };

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const r = createMsCc1SimulationRunner(structuredClone(level));
let prev = 0;
let i = 0;
for (const rec of sol.twsRecords) {
  i += 1;
  const dir = TWS_DIR[rec.direction]!;
  const gap = Math.max(0, rec.tick - prev - 1);
  for (let g = 0; g < gap; g++) stepMsCc1Wait(r);
  stepMsCc1Simulation(r, dir);
  if (r.playerDied || r.completed || i % 10 === 0) {
    const glider = r.monsters.find((m) => m.alive && m.kind === "ghost");
    const fires = r.monsters.filter((m) => m.alive && m.kind === "fireball");
    console.log(
      i,
      "t",
      rec.tick,
      dir[0],
      `${r.gx},${r.gy}`,
      r.playerDied ? `DIED ${r.deathMessage}` : r.completed ? "WIN" : "",
      "mb",
      r.buttonPressCtx.moveBoundary,
      "toggle",
      getCompositeTile(r.level, 16, 15),
      "keys",
      r.playerState.keys.join(",") || "-",
      "glider",
      glider ? `${glider.x},${glider.y}` : "-",
      "fires",
      fires.length,
      fires
        .slice(0, 4)
        .map((f) => `${f.x},${f.y}`)
        .join(" "),
    );
  }
  if (r.playerDied || r.completed) break;
  prev = rec.tick;
}
console.log({
  rem: msSecondsRemaining(100, r.buttonPressCtx.moveBoundary),
  completed: r.completed,
  died: r.playerDied,
});
