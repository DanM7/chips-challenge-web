import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    new URL(
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const PREFIX =
  "RRRRLLDDDDUUUURRRRRRUURRRDRUUUDDDLLDRDRUUUUUUDDDLLLLDRRRDRUUUUUUDDDDDLLLLDRRRDRUUUUUUUUUDDDDDRRURRDLULDRULDR" +
  "RDLULUUUDUUUUUUUUUUUDUDDDDDLLLLRRRRDDDDDDUUUULLLLRRRRDWDDDUUUUUURRRRLLLLDDDDRRRRRRUUR";

const r = createMsCc1SimulationRunner(structuredClone(level));
const re = /(\d*)([UDLRW])/g;
let m: RegExpExecArray | null;
while ((m = re.exec(PREFIX))) {
  const c = m[1] ? Number.parseInt(m[1], 10) : 1;
  const ch = m[2]!;
  for (let i = 0; i < c; i++) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right",
      );
  }
}

console.log("chips left:");
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    if (getCompositeTile(r.level, x, y) === "chip") console.log(x, y);
  }
}
console.log("bugs:");
for (const mon of r.monsters) {
  if (mon.kind.includes("bug")) console.log(mon.kind, mon.x, mon.y);
}
console.log("local:");
for (let y = 0; y <= 20; y++) {
  let row = `${String(y).padStart(2)}: `;
  for (let x = 0; x <= 18; x++) {
    if (x === r.gx && y === r.gy) {
      row += "C";
      continue;
    }
    const t = getCompositeTile(r.level, x, y);
    row +=
      t === "empty" || t === "gravel"
        ? "."
        : t === "wall"
          ? "#"
          : t === "chip"
            ? "*"
            : t === "block_movable"
              ? "B"
              : t === "bomb"
                ? "o"
                : t === "socket"
                  ? "S"
                  : t.startsWith("bug")
                    ? "b"
                    : t === "block_blue_wall"
                      ? "w"
                      : t === "block_blue_tile"
                        ? "f"
                        : t[0]!;
  }
  console.log(row);
}
