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
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-003.json",
    ),
    "utf8",
  ),
);
normalizeLevelLayers(level);

for (let y = 10; y <= 20; y++) {
  let row = `${String(y).padStart(2)} `;
  for (let x = 10; x <= 22; x++) {
    const t = getCompositeTile(level, x, y);
    const short =
      t === "empty" ? "." :
      t === "wall" ? "#" :
      t === "chip" ? "c" :
      t === "exit" ? "E" :
      t.startsWith("force") ? "f" :
      t.startsWith("fire") ? "F" :
      t === "water" ? "w" :
      t.startsWith("ice") ? "i" :
      t.includes("boots") || t === "flippers" || t === "ice_skates" ? "T" :
      t === "chip_s" ? "S" :
      t[0] ?? "?";
    row += short;
  }
  console.log(row);
}
