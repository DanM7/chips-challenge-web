import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { createMsCc1SimulationRunner } from "../engine/msCc1/msCc1Simulation.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json",
    "utf8",
  ),
);
normalizeLevelLayers(level);
const r = createMsCc1SimulationRunner(structuredClone(level));
console.log("start", r.gx, r.gy, "completed?", r.completed);

const blocks = [];
const flippers = [];
let exit = null;
for (let y = 0; y < 32; y++) {
  let row = "";
  for (let x = 0; x < 32; x++) {
    const t = getCompositeTile(level, x, y);
    if (t === "block" || t.startsWith("block")) blocks.push([x, y, t]);
    if (t === "flippers") flippers.push([x, y]);
    if (t === "exit") exit = [x, y];
    if (x === r.gx && y === r.gy) row += "C";
    else if (t === "block" || t.startsWith("block")) row += "B";
    else if (t === "flippers") row += "F";
    else if (t === "exit") row += "E";
    else if (t === "water") row += "~";
    else if (t === "wall") row += "#";
    else if (t === "gravel") row += ".";
    else if (t === "dirt") row += "d";
    else row += " ";
  }
  if (/[CBFEbd.~]/.test(row) || row.includes("#")) console.log(String(y).padStart(2), row);
}
console.log("blocks", blocks);
console.log("flippers", flippers);
console.log("exit", exit);
