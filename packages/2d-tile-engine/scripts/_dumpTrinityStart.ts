import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-011.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

console.log("start", level.playerStart);
for (let y = 16; y <= 22; y++) {
  const row: string[] = [];
  for (let x = 6; x <= 18; x++) {
    const t = getCompositeTile(level, x, y) ?? "empty";
    const f = getForceFloorTileAt(level, x, y);
    let ch = ".";
    if (t === "wall") ch = "#";
    else if (f === "force_s") ch = "v";
    else if (f === "force_n") ch = "^";
    else if (f === "force_e") ch = ">";
    else if (f === "force_w") ch = "<";
    else if (f === "force_any") ch = "*";
    else if (t.includes("key")) ch = "K";
    else if (t.includes("door")) ch = "D";
    else if (t.startsWith("chip") && !t.startsWith("chip_")) ch = "c";
    else if (t.startsWith("chip_")) ch = "@";
    else if (t === "fire") ch = "f";
    else if (t === "water") ch = "~";
    else if (t === "ice") ch = "i";
    else if (t.includes("fireball") || t.startsWith("ghost")) ch = "M";
    else if (t !== "empty") ch = "?";
    row.push(ch);
  }
  console.log(String(y).padStart(2), row.join(""));
}

const prefix: Direction[] = ["down", "left", "left", "left", "down"];
const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of prefix) {
  stepMsCc1Simulation(r, d);
  console.log(
    d,
    `${r.gx},${r.gy}`,
    "force",
    getForceFloorTileAt(r.level, r.gx, r.gy),
    "comp",
    getCompositeTile(r.level, r.gx, r.gy),
    r.playerDied ? r.deathMessage : "",
  );
}

console.log("--- try U from here ---");
const before = `${r.gx},${r.gy}`;
stepMsCc1Simulation(r, "up");
console.log(before, "U ->", `${r.gx},${r.gy}`, getForceFloorTileAt(r.level, r.gx, r.gy));
