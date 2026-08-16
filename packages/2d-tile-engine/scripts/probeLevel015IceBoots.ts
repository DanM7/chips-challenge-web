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
import type { Direction, LevelData } from "../engine/types.js";

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

const TIME_LIMIT = 250;
const BOLD = 89;
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";
const dirs: Direction[] = ["up", "down", "left", "right"];

const saved = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[] };

// Ensure we have fire path appended
const fireSeq = "UUURRRRRRDRDLLLLL";
const baseLetters = saved.letters.includes("UUURRRRRRDRDLLLLL"[0]!) && saved.label === "fail-ice_skates"
  ? saved.letters // may already have fire if fail saved without fire - check
  : saved.letters;

function applyLetters(letters: string[]): Runner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (r.playerDied) break;
  }
  return r;
}

// Rebuild from blue_key save + fire
const blueKeyLetters = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
).letters as string[];

// The file may be fail-ice without fire. Reconstruct: find length at blue_key was 360 letters?
// Re-run from chips6 file - we need blue_key state. Re-apply SW deep chips6 + blue + fire.

// Simpler: test ice paths from current if we have fire boots
let letters = [...blueKeyLetters];
let r = applyLetters(letters);
console.log("loaded", {
  pos: [r.gx, r.gy],
  tools: r.playerState.tools,
  keys: r.playerState.keys,
  label: JSON.parse(readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8")).label,
});

if (!r.playerState.tools.includes("fire_boots")) {
  letters = [...letters, ...fireSeq.split("")];
  r = applyLetters(letters);
  console.log("added fire", {
    pos: [r.gx, r.gy],
    tools: r.playerState.tools,
    keys: r.playerState.keys,
    died: r.playerDied,
  });
}

// Manual ice skates paths
for (const s of [
  // back to center via row 10, open red door (20,15), to SE block
  "UUULLLLLLDDDDRRRRRRD",
  "U U U LLLLLL DD DD RRRRRR D".replace(/ /g, ""),
  "LLLLLLDDDDRRRRRRD",
  "ULLLLLDDDDRRRRRRD",
  // from (22,12): UUU LLLLLL to (16,10), DDDDD to red door area
  "UUULLLLLLDDDDDRRRRRRD",
  "UUULLLLLLDDDDDDRRRRRRDLLURRRR",
]) {
  const t = applyLetters([...letters, ...s.split("")]);
  console.log(s.slice(0, 30), {
    pos: [t.gx, t.gy],
    tools: t.playerState.tools,
    keys: t.playerState.keys,
    bomb: cellTile(t.level, "upper", 24, 14),
    skatesUnder: getCompositeTile(t.level, 26, 15),
    died: t.playerDied,
    death: t.deathMessage,
  });
}
