import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { tick: number; direction: number }[] };

const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

// Pure direction sequence from TWS (no waits)
const dirs = sol.twsRecords
  .map((r) => TWS_DIR[r.direction])
  .filter((d): d is Direction => !!d);
const letters = dirs.map((d) => LETTER[d]);
console.log("TWS chip moves", letters.length);
console.log("first 100:", letters.slice(0, 100).join(""));
console.log("100-200:", letters.slice(100, 200).join(""));
console.log("200-300:", letters.slice(200, 300).join(""));

// Compress to run-length for readability
function compress(ls: string[]): string {
  let out = "";
  let i = 0;
  while (i < ls.length) {
    let j = i;
    while (j < ls.length && ls[j] === ls[i]) j++;
    const n = j - i;
    out += (n > 1 ? String(n) : "") + ls[i];
    i = j;
  }
  return out;
}
console.log("compressed:", compress(letters));

// Replay TWS dirs only (no waits) with odd parity - will desync monsters but shows intended geometry
function replayDirs(parity: "even" | "odd", max = 200) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  const path: string[] = [];
  for (let i = 0; i < Math.min(dirs.length, max); i++) {
    const before = `${r.gx},${r.gy}`;
    stepMsCc1Simulation(r, dirs[i]!);
    path.push(`${i + 1}:${LETTER[dirs[i]!]}${before}->${r.gx},${r.gy}`);
    if (r.playerDied) {
      console.log("died", parity, "at", i + 1, r.deathMessage, `${r.gx},${r.gy}`);
      console.log(path.slice(-15).join(" | "));
      return;
    }
    if (r.completed) {
      console.log("completed", parity, "at", i + 1, "rem", msSecondsRemaining(210, r.buttonPressCtx.moveBoundary));
      return;
    }
  }
  console.log("alive", parity, "after", max, `${r.gx},${r.gy}`, "chips", r.playerState.chipsRemainingOnMap);
}

replayDirs("odd", 120);
replayDirs("even", 120);

// Show dirt map around lower area
console.log("\nDirt/floor/chip map y=10..22 x=1..30");
for (let y = 10; y <= 22; y++) {
  let row = "";
  for (let x = 1; x <= 30; x++) {
    const t = getCompositeTile(level, x, y) ?? "empty";
    if (t === "dirt") row += ",";
    else if (t === "chip" || t === "chip_w") row += "@";
    else if (t === "wall") row += "#";
    else if (t.includes("frog") || t.includes("teeth")) row += "T";
    else if (t === "socket") row += "S";
    else if (t === "exit") row += "E";
    else if (t === "empty" || t === "floor") row += ".";
    else row += "?";
  }
  console.log(String(y).padStart(2), row);
}
