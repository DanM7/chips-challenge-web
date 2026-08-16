import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const counts = new Map<string, number>();
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    for (const layer of ["upper", "lower"] as const) {
      const t = cellTile(level, layer, x, y);
      if (t !== "empty") counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
}
console.log(
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${c}\t${t}`)
    .join("\n"),
);

// center area detail
console.log("\nCENTER 8-24 x 8-20:");
for (let y = 8; y <= 20; y++) {
  let row = "";
  for (let x = 8; x <= 24; x++) {
    const u = cellTile(level, "upper", x, y);
    const l = cellTile(level, "lower", x, y);
    const t = u !== "empty" ? u : l;
    row += t === "empty" ? "." : t[0];
  }
  console.log(y, row);
}
