import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
import { simulateMsCc1Level } from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelPath = path.join(
  __dirname,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
);
const solutionsPath = path.join(__dirname, "../integration/data/cc1-ms-solutions.json");

const level = JSON.parse(fs.readFileSync(levelPath, "utf8"));
normalizeLevelLayers(level);
const doc = JSON.parse(fs.readFileSync(solutionsPath, "utf8"));

const tws = doc.levels["2"].twsMoves;
const stored = doc.levels["2"].moves;

for (const [label, moves] of [
  ["tws", parseCcMoveStringMs(tws)],
  ["stored", stored],
]) {
  const r = simulateMsCc1Level(structuredClone(level), moves);
  console.log(label, {
    len: moves.length,
    completed: r.completed,
    died: r.playerDied,
    death: r.deathMessage,
    pos: r.finalPosition,
    chips: r.finalPlayerState.chipsRemainingOnMap,
  });
}
