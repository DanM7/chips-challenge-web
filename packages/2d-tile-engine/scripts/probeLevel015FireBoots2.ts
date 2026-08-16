import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import { createMsCc1SimulationRunner, stepMsCc1Simulation, stepMsCc1Wait } from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(readFileSync(path.join(root, "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json"), "utf8")) as LevelData;
normalizeLevelLayers(level);
const saved = JSON.parse(readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8")) as { letters: string[] };

function run(s: string) {
  const t = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of saved.letters) {
    if (ch === "W") stepMsCc1Wait(t);
    else stepMsCc1Simulation(t, (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction);
  }
  for (const c of s) {
    stepMsCc1Simulation(t, (c === "U" ? "up" : c === "D" ? "down" : c === "L" ? "left" : "right") as Direction);
    if (t.playerDied) break;
  }
  console.log(s, { pos: [t.gx,t.gy], tools: t.playerState.tools, keys: t.playerState.keys, bomb: cellTile(t.level,"upper",24,12), fireboots: getCompositeTile(t.level,26,11), died: t.playerDied, death: t.deathMessage });
}
for (const s of ["UUURRRRRRD","UUURRRRRRDLDRLL","UUURRRRRRDLDLLURR","UUURRRRRRDLDLLURR"]) run(s);
