import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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

const short: Record<string, string> = {
  empty: ".",
  wall: "#",
  chip: "c",
  chip_socket: "S",
  exit: "E",
  water: "~",
  fire: "*",
  ice: "I",
  gravel: "g",
  dirt: "d",
  force_north: "^",
  force_south: "v",
  force_east: ">",
  force_west: "<",
  force_random: "?",
  key_red: "r",
  key_blue: "b",
  key_yellow: "y",
  key_green: "n",
  lock_red: "R",
  lock_blue: "B",
  lock_yellow: "Y",
  lock_green: "N",
  flippers: "f",
  fire_boots: "F",
  ice_skates: "k",
  suction_boots: "u",
  block: "o",
  thief: "T",
  button_brown: "+",
  trap: "t",
  button_red: "-",
  button_blue: "=",
  button_green: "%",
  teleport: "@",
  bomb: "!",
  clone_machine: "m",
  hint: "h",
  recessed_wall: "_",
};

const lines: string[] = [];
for (let y = 0; y < 32; y++) {
  let row = "";
  for (let x = 0; x < 32; x++) {
    const t = getCompositeTile(level, x, y) as string;
    row += short[t] ?? (t ? t[0] : "?");
  }
  lines.push(`${String(y).padStart(2, "0")} ${row}`);
}
const out = lines.join("\n") + "\n";
writeFileSync(path.join(root, ".tmp/level015-map.txt"), out);
console.log(out);
