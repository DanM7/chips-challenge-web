/** Dump Trinity west of 11,20 and try scripted paths toward red key. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-011.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const r0 = createMsCc1SimulationRunner(structuredClone(level));
for (const d of ["down", "left", "left", "left", "down"] as Direction[]) stepMsCc1Simulation(r0, d);

function glyph(r: typeof r0, x: number, y: number): string {
  if (x === r.gx && y === r.gy) return "@";
  const mon = r.monsters.find((m) => m.alive && m.x === x && m.y === y);
  if (mon) return "M";
  const t = getCompositeTile(r.level, x, y);
  const f = getForceFloorTileAt(r.level, x, y);
  if (t === "wall") return "#";
  if (t?.includes("key_red")) return "R";
  if (t === "fire") return "f";
  if (t === "water") return "~";
  if (t === "ice") return "i";
  if (f === "force_s") return "v";
  if (f === "force_n") return "^";
  if (f === "force_e") return ">";
  if (f === "force_w") return "<";
  if (t && t !== "empty") return "?";
  return ".";
}

console.log("start", r0.gx, r0.gy);
for (let y = 6; y <= 30; y++) {
  let row = "";
  for (let x = 0; x <= 12; x++) row += glyph(r0, x, y);
  console.log(String(y).padStart(2), row);
}

function apply(seq: string) {
  const r = cloneMsCc1SimulationRunner(r0);
  const re = /(\d*)([UDLRW])/g;
  let m: RegExpExecArray | null;
  const s = seq.replace(/\s+/g, "");
  while ((m = re.exec(s))) {
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    const ch = m[2]!;
    for (let i = 0; i < n; i++) {
      if (ch === "W") stepMsCc1Wait(r);
      else
        stepMsCc1Simulation(
          r,
          ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right",
        );
      if (r.playerDied) return { seq, pos: `${r.gx},${r.gy}`, died: r.deathMessage, keys: r.playerState.keys };
    }
  }
  return { seq, pos: `${r.gx},${r.gy}`, died: false as const, keys: r.playerState.keys, force: getForceFloorTileAt(r.level, r.gx, r.gy) };
}

const trials = [
  "L",
  "LL",
  "LLU",
  "LLUU",
  "LLD",
  "LLDD",
  "LLDDL",
  "2L 2D 5L",
  "2L U 2L",
  "2L 2U 4L",
  "2L 2U 2L 2D 5L",
  "2L D 2L",
  "U",
  "UL",
  "2L 8D 8L 10U",
  "2L 2D L 2D 5L UUU",
  "2L 2U L U L",
  "2L 2U LL D LLL UUUUUU",
];
for (const t of trials) console.log(apply(t));
