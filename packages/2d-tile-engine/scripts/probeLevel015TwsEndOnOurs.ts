import { readFileSync, writeFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const tws = JSON.parse(readFileSync("integration/data/cc1-ms-solutions/level-015.json", "utf8")) as {
  moves: string[];
};
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

function blockPos(r: ReturnType<typeof apply>) {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "none";
}

// Find TWS index when brown gets block
const tr = createMsCc1SimulationRunner(structuredClone(level));
let brownIdx = -1;
let chips0Idx = -1;
for (let i = 0; i < tws.moves.length; i++) {
  const ch = tws.moves[i]!;
  if (ch === "W") stepMsCc1Wait(tr);
  else
    stepMsCc1Simulation(
      tr,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
  if (chips0Idx < 0 && tr.playerState.chipsRemainingOnMap === 0) {
    chips0Idx = i;
    console.log("TWS chips0", {
      i,
      pos: [tr.gx, tr.gy],
      block: blockPos(tr),
      keys: tr.playerState.keys,
      tools: tr.playerState.tools,
      d11: cellTile(tr.level, "upper", 16, 11),
      d15: cellTile(tr.level, "upper", 16, 15),
      rem: msSecondsRemaining(250, tr.buttonPressCtx.moveBoundary),
    });
  }
  if (brownIdx < 0 && getCompositeTile(tr.level, 16, 9) === "block_movable") {
    brownIdx = i;
    console.log("TWS brown", {
      i,
      pos: [tr.gx, tr.gy],
      block: blockPos(tr),
      keys: tr.playerState.keys,
      rem: msSecondsRemaining(250, tr.buttonPressCtx.moveBoundary),
    });
    console.log("moves chips0→brown", tws.moves.slice(chips0Idx + 1, brownIdx + 1).join(""));
    console.log("moves brown→end", tws.moves.slice(brownIdx + 1).join(""));
  }
}

// Our state
const ours = apply(saved.letters);
console.log("ours", {
  pos: [ours.gx, ours.gy],
  block: blockPos(ours),
  keys: ours.playerState.keys,
  tools: ours.playerState.tools,
  d11: cellTile(ours.level, "upper", 16, 11),
  d15: cellTile(ours.level, "upper", 16, 15),
  rem: msSecondsRemaining(250, ours.buttonPressCtx.moveBoundary),
});

// Try appending TWS end from chips0
const twsEnd = tws.moves.slice(chips0Idx + 1);
console.log("try TWS end len", twsEnd.length, twsEnd.join(""));
{
  const letters = [...saved.letters, ...twsEnd];
  const r = apply(letters);
  console.log("TWS end on ours", {
    done: r.completed,
    died: r.playerDied,
    rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    pos: [r.gx, r.gy],
  });
}
