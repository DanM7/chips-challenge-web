import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

function dumpRegion(x0: number, y0: number, w: number, h: number): void {
  console.log(`Region ${x0},${y0} ${w}x${h} (composite / upper / lower):`);
  for (let y = y0; y < y0 + h; y += 1) {
    let row = "";
    for (let x = x0; x < x0 + w; x += 1) {
      const c = getCompositeTile(level, x, y).slice(0, 4);
      const mark = x === 13 && y === 16 ? "*" : " ";
      row += `${mark}${c.padEnd(4)} `;
    }
    console.log(`${y}: ${row}`);
  }
}

describe("level 001 map dump", () => {
  it("dumps play area", () => {
    console.log("playerStart", level.playerStart);
    console.log("chipsRequired", level.chipsRequired);
    dumpRegion(10, 10, 12, 10);
    dumpRegion(10, 14, 8, 6);
    for (const [x, y] of [
      [13, 14],
      [13, 15],
      [13, 16],
      [13, 17],
      [12, 16],
      [14, 16],
    ]) {
      console.log(
        `(${x},${y}) upper=${cellTile(level, "upper", x, y)} lower=${cellTile(level, "lower", x, y)} composite=${getCompositeTile(level, x, y)}`,
      );
    }
  });
});
