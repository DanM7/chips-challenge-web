import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const saved = JSON.parse(readFileSync(".tmp/level015-bold-letters.json", "utf8")) as {
  letters: string[];
};

function apply(letters: string[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
  }
  return r;
}

const r = apply(saved.letters);
console.log("at", r.gx, r.gy, "tools", r.playerState.tools);
for (let y = 24; y <= 31; y++) {
  let row = "";
  for (let x = 16; x <= 31; x++) {
    const c = getCompositeTile(r.level, x, y);
    const mark = x === r.gx && y === r.gy ? "@" : "";
    const short =
      c === "floor"
        ? "."
        : c === "wall"
          ? "#"
          : c === "ice"
            ? "I"
            : c === "thief"
              ? "T"
              : c === "water"
                ? "~"
                : c === "force_floor_n" ||
                    c === "force_floor_s" ||
                    c === "force_floor_e" ||
                    c === "force_floor_w" ||
                    c === "force_floor_random"
                  ? "F"
                  : c === "block_movable"
                    ? "B"
                    : c === "key_blue"
                      ? "b"
                      : c === "key_red"
                        ? "r"
                        : c === "computer_chip"
                          ? "c"
                          : c[0]?.toUpperCase() ?? "?";
    row += (mark + short).padStart(2, " ");
  }
  console.log(String(y).padStart(2), row);
}

// Try each direction from thief
for (const d of ["up", "down", "left", "right"] as Direction[]) {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  console.log("try", d, {
    pos: [n.gx, n.gy],
    died: n.playerDied,
    tools: n.playerState.tools,
    standing: getCompositeTile(n.level, n.gx, n.gy),
  });
}

// Check approach: rewind - find when we got to chips1 and whether blue key path exists before thief
// Load TWS
const tws = JSON.parse(
  readFileSync("integration/data/cc1-ms-solutions/level-015.json", "utf8"),
) as { moves: string[] };
const twsR = apply(tws.moves);
console.log("TWS end", {
  pos: [twsR.gx, twsR.gy],
  done: twsR.completed,
  ticks: twsR.buttonPressCtx.moveBoundary,
});

// Find TWS position when chips hit 0
{
  const rr = createMsCc1SimulationRunner(structuredClone(level));
  let prev = 99;
  for (let i = 0; i < tws.moves.length; i++) {
    const ch = tws.moves[i]!;
    if (ch === "W") stepMsCc1Wait(rr);
    else
      stepMsCc1Simulation(
        rr,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (rr.playerState.chipsRemainingOnMap < prev) {
      console.log("TWS chips", rr.playerState.chipsRemainingOnMap, "at", [rr.gx, rr.gy], "i", i, "tools", rr.playerState.tools, "keys", rr.playerState.keys);
      prev = rr.playerState.chipsRemainingOnMap;
    }
    if (rr.gx === 25 && rr.gy === 28) {
      console.log("TWS at thief i", i, "chips", rr.playerState.chipsRemainingOnMap, "keys", rr.playerState.keys, "tools", rr.playerState.tools);
    }
  }
}
