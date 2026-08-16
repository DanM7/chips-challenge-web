import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json",
    "utf8",
  ),
);
normalizeLevelLayers(level);

console.log("around start:");
for (let y = 28; y <= 30; y++) {
  const parts = [];
  for (let x = 0; x <= 12; x++) {
    parts.push(`${x},${y}=${getCompositeTile(level, x, y)}`);
  }
  console.log(parts.join(" | "));
}

const r = createMsCc1SimulationRunner(structuredClone(level));
console.log("start", r.gx, r.gy, getCompositeTile(level, r.gx, r.gy));
for (const d of ["left", "right", "up", "down"]) {
  const s = createMsCc1SimulationRunner(structuredClone(level));
  const ok = stepMsCc1Simulation(s, /** @type {any} */ (d));
  console.log(d, "ok", ok, "pos", s.gx, s.gy, "died", s.playerDied, "mb", s.buttonPressCtx.moveBoundary);
}

const tiles = level.layers.lower.tiles;
const prefix = level.layers.lower.emptyPrefix ?? 0;
const idx = tiles.indexOf("flippers");
const pos = prefix + idx;
console.log(
  "flippers idx",
  idx,
  "pos",
  pos,
  "x",
  pos % 32,
  "y",
  Math.floor(pos / 32),
  "composite",
  getCompositeTile(level, pos % 32, Math.floor(pos / 32)),
);
console.log("layers", Object.keys(level.layers));
console.log("has upper", !!level.layers.upper);

// Check if block sits on flippers
const fx = pos % 32;
const fy = Math.floor(pos / 32);
console.log("cell at flippers", {
  composite: getCompositeTile(level, fx, fy),
  // dump cell if layered
  lower: level.layers.lower?.grid?.[fy]?.[fx],
  upper: level.layers.upper?.grid?.[fy]?.[fx],
});

// Print raw packed neighbors of start
const startPos = 30 * 32 + 5;
console.log("start packed index", startPos - prefix, "tile", tiles[startPos - prefix]);
for (const [dx, dy] of [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
]) {
  const p = (30 + dy) * 32 + (5 + dx);
  const ti = p - prefix;
  console.log(`neighbor ${5 + dx},${30 + dy} packed=${tiles[ti]} composite=${getCompositeTile(level, 5 + dx, 30 + dy)}`);
}
