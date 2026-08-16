import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
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

console.log("start", level.playerStart, "time", level.timeLimit, "chips", level.chipsRequired);
console.log("size", level.width, "x", level.height);

const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { tick: number; direction: number }[] };

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];

function simTws(parity: "even" | "odd") {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  let prev = 0;
  let step = 0;
  for (const rec of sol.twsRecords) {
    const dir = TWS_DIR[rec.direction];
    if (!dir) continue;
    const gap = Math.max(0, rec.tick - prev - 1);
    for (let i = 0; i < gap; i++) {
      stepMsCc1Wait(r);
      if (r.playerDied) break;
    }
    stepMsCc1Wait(r);
    step++;
    stepMsCc1Simulation(r, dir);
    if (r.playerDied || r.completed) break;
    prev = rec.tick;
  }
  return {
    parity,
    completed: r.completed,
    died: r.playerDied,
    death: r.deathMessage,
    pos: `${r.gx},${r.gy}`,
    chips: r.playerState.chipsRemainingOnMap,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
    step,
    monstersAlive: r.monsters.filter((m) => m.alive).length,
  };
}

console.log("TWS even", simTws("even"));
console.log("TWS odd", simTws("odd"));

// ASCII map
for (let y = 0; y < level.height; y++) {
  const row: string[] = [];
  for (let x = 0; x < level.width; x++) {
    const t = getCompositeTile(level, x, y) ?? "empty";
    let ch = ".";
    if (x === level.playerStart?.x && y === level.playerStart?.y) ch = "P";
    else if (t === "wall") ch = "#";
    else if (t === "empty" || t === "floor") ch = ".";
    else if (t === "chip" || t === "chip_w") ch = "@";
    else if (t === "exit") ch = "E";
    else if (t === "dirt") ch = ",";
    else if (t === "gravel") ch = ":";
    else if (t === "socket") ch = "S";
    else if (t.includes("teeth")) ch = "T";
    else if (t === "water") ch = "~";
    else if (t === "fire") ch = "^";
    else ch = "?";
    row.push(ch);
  }
  console.log(String(y).padStart(2), row.join(""));
}
