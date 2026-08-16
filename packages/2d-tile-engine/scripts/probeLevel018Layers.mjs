import { readFileSync } from "node:fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json",
    "utf8",
  ),
);
normalizeLevelLayers(level);

console.log("=== upper/lower/composite around start ===");
for (let y = 27; y <= 31; y++) {
  for (let x = 0; x <= 14; x++) {
    const u = cellTile(level, "upper", x, y);
    const l = cellTile(level, "lower", x, y);
    const c = getCompositeTile(level, x, y);
    if (u !== "empty" || l !== "empty" || (x >= 3 && x <= 7)) {
      console.log(`${x},${y} U=${u.padEnd(16)} L=${l.padEnd(16)} C=${c}`);
    }
  }
}

console.log("\n=== flippers cell ===");
for (let y = 0; y <= 3; y++) {
  for (let x = 26; x <= 31; x++) {
    console.log(
      `${x},${y} U=${cellTile(level, "upper", x, y)} L=${cellTile(level, "lower", x, y)} C=${getCompositeTile(level, x, y)}`,
    );
  }
}

console.log("\n=== block in middle of vertical wall candidates ===");
// Look for block_movable with wall N/S and empty E/W or similar
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    if (getCompositeTile(level, x, y) !== "block_movable") continue;
    const n = getCompositeTile(level, x, y - 1);
    const s = getCompositeTile(level, x, y + 1);
    const e = getCompositeTile(level, x + 1, y);
    const w = getCompositeTile(level, x - 1, y);
    const vertWall = (n === "wall" || n === "block_movable") && (s === "wall" || s === "block_movable");
    console.log(`block ${x},${y} N=${n} S=${s} E=${e} W=${w} vertish=${vertWall}`);
  }
}
