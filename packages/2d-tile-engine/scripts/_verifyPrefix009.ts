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
  "RDLULUU" +
  "UD" +
  "UUUUUUUUUUU" +
  "DUDDDDDLLLLRRRRDDDDDDUUUULLLLRRRRDWDDDUUUUUURRRR" +
  "LLLLDDDDRRRRRRUUR";

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
    if (r.playerDied) break;
  }
  if (r.playerDied) break;
}
console.log({
  pos: [r.gx, r.gy],
  chips: r.playerState.chipsRemainingOnMap,
  keys: r.playerState.keys,
  died: r.playerDied,
  death: r.deathMessage,
  tile: getCompositeTile(r.level, r.gx, r.gy),
  mb: r.buttonPressCtx.moveBoundary,
});
