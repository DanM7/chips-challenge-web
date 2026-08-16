import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

for (const [x, y] of [
  [14, 11],
  [14, 12],
  [14, 13],
  [13, 11],
  [12, 11],
  [11, 5],
  [12, 5],
]) {
  console.log(x, y, getCompositeTile(level, x, y));
}

const route: Direction[] = [
  // trap + key
  "up","up","right","up","up","up","up",
  "left","left","left","left","left","left","left",
  "right","right",
  "right","right","right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left",
  "up","up","up",
  // back around to door
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left",
  "up", // through door 14,12
];

const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of route) {
  stepMsCc1Simulation(r, d);
  if (r.playerDied) {
    console.log("died", r.gx, r.gy, r.deathMessage);
    process.exit(1);
  }
}
console.log("after door", r.gx, r.gy, "keys", r.playerState.keys, "rem", msSecondsRemaining(100, r.buttonPressCtx.moveBoundary));

// Brown buttons at 16,7 and 16,10 — walk to them
const browns: Direction[] = [
  "up","up","up","up","up", // toward upper
  "right","right",
  // need to navigate bomb maze to browns
];
console.log("nearby tiles:");
for (let y = 5; y <= 12; y++) {
  let row = "";
  for (let x = 11; x <= 20; x++) {
    const t = getCompositeTile(r.level, x, y) ?? "empty";
    row +=
      t === "wall"
        ? "#"
        : t === "bomb"
          ? "*"
          : t === "exit"
            ? "E"
            : t === "button_brown"
              ? "b"
              : t === "trap"
                ? "t"
                : t.startsWith("ghost")
                  ? "G"
                  : t === "empty"
                    ? "."
                    : "?";
  }
  console.log(y, row, "chip?", r.gx === 11 && false);
}
console.log("chip at", r.gx, r.gy);
