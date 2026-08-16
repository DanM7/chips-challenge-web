import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { createMsCc1Monsters } from "../engine/msCc1/msCc1Monsters.js";
import type { LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const map: Record<string, string> = {
  wall: "#",
  floor: ".",
  empty: ".",
  chip: "*",
  water: "~",
  block: "O",
  dirt: "d",
  socket: "S",
  exit: "E",
  hint: "H",
};

console.log("start", level.playerStart, "chips", level.chipsRequired, "time", level.timeLimit);
const monsters = createMsCc1Monsters(level);
console.log(
  "monsters",
  monsters.map((m) => `${m.kind}@${m.x},${m.y} facing ${m.direction}`),
);

console.log("   " + [...Array(20)].map((_, i) => String((7 + i) % 10)).join(""));
for (let y = 7; y <= 17; y++) {
  let row = String(y).padStart(2) + " ";
  for (let x = 7; x <= 26; x++) {
    const t = getCompositeTile(level, x, y);
    const mon = monsters.find((m) => m.x === x && m.y === y && m.alive);
    if (mon) {
      row += "b";
      continue;
    }
    if (t?.startsWith("chip_")) {
      row += "C";
      continue;
    }
    if (t?.startsWith("block")) {
      row += "O";
      continue;
    }
    row += map[t] ?? t?.[0] ?? "?";
  }
  console.log(row);
}

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
  }
}
