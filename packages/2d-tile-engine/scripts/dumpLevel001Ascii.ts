import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const map: Record<string, string> = {
  wall: "#",
  floor: ".",
  chip: "*",
  key_yellow: "Y",
  key_blue: "B",
  key_red: "R",
  key_green: "G",
  door_yellow: "y",
  door_blue: "b",
  door_red: "r",
  door_green: "g",
  socket: "S",
  exit: "E",
  hint: "H",
  empty: " ",
  chip_n: "C",
};

console.log("   " + [...Array(15)].map((_, i) => String(8 + i).padStart(2)).join(""));
for (let y = 8; y <= 21; y++) {
  let row = String(y).padStart(2) + " ";
  for (let x = 8; x <= 22; x++) {
    const t = getCompositeTile(level, x, y);
    const ch =
      map[t] ??
      (t?.startsWith("chip_") ? "C" : t === "floor" || !t ? "." : "?");
    // floor may be empty in composite - show .
    const shown =
      t === "empty" || t === "floor" || t === undefined
        ? "."
        : map[t] ?? t[0];
    row += shown + " ";
  }
  console.log(row);
}

// list interesting tiles
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    const t = getCompositeTile(level, x, y);
    if (
      t &&
      t !== "wall" &&
      t !== "empty" &&
      t !== "floor" &&
      !t.startsWith("chip_")
    ) {
      console.log(`${x},${y} ${t}`);
    }
    if (t?.startsWith("chip_")) console.log(`${x},${y} ${t}`);
  }
}
