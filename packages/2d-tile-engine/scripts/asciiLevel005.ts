import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
console.log("start", level.playerStart, level.width, "x", level.height);
for (let y = 0; y < level.height; y++) {
  const row: string[] = [];
  for (let x = 0; x < level.width; x++) {
    const t = getCompositeTile(level, x, y) ?? "empty";
    let ch = ".";
    if (t === "wall") ch = "#";
    else if (t === "empty" || t === "floor") ch = ".";
    else if (t.startsWith("key_")) ch = t[4]!.toUpperCase();
    else if (t.startsWith("door_")) ch = t[5]!;
    else if (t.includes("clone")) ch = "C";
    else if (t.startsWith("fireball")) ch = "F";
    else if (t.startsWith("ghost") || t.startsWith("glider")) ch = "G";
    else if (t.startsWith("ball")) ch = "o";
    else if (t === "button_red") ch = "r";
    else if (t === "button_brown") ch = "b";
    else if (t === "button_green") ch = "g";
    else if (t === "button_blue") ch = "u";
    else if (t === "trap") ch = "t";
    else if (t === "bomb") ch = "*";
    else if (t === "exit") ch = "E";
    else if (t.includes("toggle_open")) ch = "=";
    else if (t.includes("toggle_closed")) ch = "+";
    else if (t.startsWith("chip")) ch = "@";
    else if (t === "water") ch = "~";
    else if (t === "fire") ch = "^";
    else if (t === "gravel") ch = ":";
    else if (t === "dirt") ch = ",";
    else ch = "?";
    row.push(ch);
  }
  const line = row.join("");
  if (/[^#.]/.test(line) || y >= 4) console.log(String(y).padStart(2), line);
}
