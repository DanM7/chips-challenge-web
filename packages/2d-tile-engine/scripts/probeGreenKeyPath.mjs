import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../../../cc1-asset-extraction-pipeline/.tmp-level1"), "utf8"),
);
normalizeLevelLayers(level);

function step(r: ReturnType<typeof createMsCc1SimulationRunner>, d: string) {
  const b = { x: r.gx, y: r.gy, chips: r.playerState.chipsRemainingOnMap };
  stepMsCc1Simulation(r, d as "up");
  const moved = b.x !== r.gx || b.y !== r.gy;
  console.log(
    d,
    moved ? `${b.x},${b.y}->${r.gx},${r.gy}` : "BLOCKED",
    "chips",
    r.playerState.chipsRemainingOnMap,
    "keys",
    r.playerState.keys.join("+") || "-",
    getCompositeTile(r.level, r.gx, r.gy),
  );
}

const r = createMsCc1SimulationRunner(structuredClone(level));
// yellow key, blue door opening, south via yellow door, toward green key
for (const d of [
  "left", "left", "up", "up", "left", "left", "left",
  "right", "right", "right", "right", "right",
  "down", "down", "down", "down", "down",
  "left", "left", "down",
  "down", "right", "right", "right", "right",
  "down", "down", "left", "left", "down",
  "right", "right", "right", "right", "right", "right",
]) {
  step(r, d);
}
console.log("final", r.gx, r.gy, r.playerState.keys, r.completed);
