import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
);
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

const TIME_LIMIT = 250;
const BOLD = 89;
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";
const dirs: Direction[] = ["up", "down", "left", "right"];

function applyLetters(letters: string[]): Runner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (r.playerDied || r.completed) break;
  }
  return r;
}

function blockPos(r: Runner): string {
  for (let y = 14; y <= 16; y++)
    for (let x = 22; x <= 28; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable" && x >= 16)
        return `${x},${y}`;
  return "gone";
}

const saved = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[]; label?: string };
console.log("load", saved.label, saved.letters.length);
let letters = saved.letters;
let r = applyLetters(letters);
console.log("state", {
  pos: [r.gx, r.gy],
  tools: r.playerState.tools,
  keys: r.playerState.keys,
  block: blockPos(r),
  bomb: cellTile(r.level, "upper", 24, 14),
});

// Trace push into SE bomb for blue key
for (const s of ["RDLLLLL", "DRLLLLL", "RDLDLLLL", "URDLLLLL", "RRDLLLULLLL"]) {
  const t = applyLetters([...letters, ...s]);
  console.log(s, {
    pos: [t.gx, t.gy],
    keys: t.playerState.keys,
    bomb: cellTile(t.level, "upper", 24, 14),
    block: blockPos(t),
    died: t.playerDied,
    death: t.deathMessage,
  });
}

// Step trace best candidate
console.log("\ntrace RDLLLLL:");
{
  const t = applyLetters(letters);
  for (const c of "RDLLLLL") {
    stepMsCc1Simulation(
      t,
      (c === "U" ? "up" : c === "D" ? "down" : c === "L" ? "left" : "right") as Direction,
    );
    console.log(c, [t.gx, t.gy], "b="+blockPos(t), "bomb="+cellTile(t.level,"upper",24,14), "keys="+t.playerState.keys, t.playerDied?t.deathMessage:"");
    if (t.playerDied) break;
  }
}
