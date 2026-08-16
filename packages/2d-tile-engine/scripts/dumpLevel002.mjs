import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

console.log("start", level.playerStart, "chipsRequired", level.chipsRequired);
for (let y = 0; y < level.height; y++) {
  let row = "";
  for (let x = 0; x < level.width; x++) {
    const t = getCompositeTile(level, x, y);
    if (t === "empty") row += " . ";
    else if (t === "wall") row += " # ";
    else if (t === "chip") row += " c ";
    else if (t === "water") row += " ~ ";
    else if (t.startsWith("block")) row += " B ";
    else if (t.startsWith("hint")) row += " ? ";
    else if (t === "exit") row += " E ";
    else row += ` ${t.slice(0, 2)} `;
  }
  if (row.includes("c") || row.includes("B") || row.includes("~") || row.includes("E")) {
    console.log(String(y).padStart(2), row);
  }
}
