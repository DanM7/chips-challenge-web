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

function expand(n: string) {
  const out: string[] = [];
  const re = /(\d*)([UDLRW])/g;
  let m: RegExpExecArray | null;
  const s = n.replace(/\s+/g, "");
  while ((m = re.exec(s))) {
    const c = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < c; i++) out.push(m[2]!);
  }
  return out;
}

const route =
  "RRRRLLDDDDUUUURRRRRRUURRRDRUUUDDDLLDRDRUUUUUUDDDLLLLDRRRDRUUUUUUDDDDDLLLLDRRRDRUUUUUUUUUDDDDDRRURRDLULDRULDR" +
  "RDLULUUUDUUUUUUUUUUUDUDDDDDLLLLRRRRDDDDDDUUUULLLLRRRRDWDDDUUUUUURRRRLLLLDDDDRRRRRRUURULLDDLLLLLDDDDLLDDRRDRRURRUULUU" +
  "DDLDDLDLLLUUURRUUUUUULLLLULLDDDDDDDDDDDDDDDDDDRRUU" +
  "DDLLUUUUUUUUUUUUUUUUUURRDDDRRRRDDDDLLDDDDDLLUURRURRDLULDDULLDDRR";

const r = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of expand(route)) {
  if (ch === "W") stepMsCc1Wait(r);
  else stepMsCc1Simulation(r, ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right");
  if (r.playerDied) break;
}
console.log("pos", r.gx, r.gy, "chips", r.playerState.chipsRemainingOnMap, "died", r.playerDied);
for (let y = 12; y <= 20; y++) {
  let row = `${y}: `;
  for (let x = 4; x <= 14; x++) {
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
          : t === "block_movable"
            ? "B"
            : t === "bomb"
              ? "o"
              : t === "chip"
                ? "*"
                : t === "dirt"
                  ? "="
                  : t[0]!;
  }
  console.log(row);
}
