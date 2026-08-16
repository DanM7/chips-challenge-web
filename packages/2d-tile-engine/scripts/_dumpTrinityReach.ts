/** Dump Trinity after D 3L D + U: map, monsters, short BFS reach. */
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

function glyph(x: number, y: number, chipX: number, chipY: number): string {
  if (x === chipX && y === chipY) return "@";
  const t = getCompositeTile(level, x, y);
  const f = getForceFloorTileAt(level, x, y);
  if (t === "wall") return "#";
  if (t === "chip") return "c";
  if (t.includes("key_red")) return "R";
  if (t.includes("key_yellow")) return "Y";
  if (t.includes("key_blue")) return "B";
  if (t.includes("lock_red")) return "r";
  if (t.includes("lock_yellow")) return "y";
  if (t.includes("lock_blue")) return "b";
  if (t.includes("fireball") || t.includes("ghost") || t.includes("glider") || t.includes("ball"))
    return "M";
  if (t === "fire") return "f";
  if (t === "water") return "~";
  if (t === "ice") return "i";
  if (t.includes("skates")) return "s";
  if (t.includes("flipper")) return "p";
  if (t.includes("fire_boot") || t.includes("tool_fire")) return "F";
  if (t === "exit") return "E";
  if (t === "socket") return "S";
  if (f === "force_s") return "v";
  if (f === "force_n") return "^";
  if (f === "force_e") return ">";
  if (f === "force_w") return "<";
  if (f === "force_any") return "*";
  if (t !== "empty" && t !== "floor") return "?";
  return ".";
}

const r = createMsCc1SimulationRunner(structuredClone(level));
for (const d of ["down", "left", "left", "left", "down"] as Direction[]) stepMsCc1Simulation(r, d);
stepMsCc1Simulation(r, "up");
console.log("after open+U", `${r.gx},${r.gy}`, "died", r.playerDied);
console.log(
  "monsters",
  r.monsters.map((m) => `${m.kind}@${m.x},${m.y}:${m.direction}${m.alive ? "" : " dead"}`),
);

for (let y = 0; y < 32; y++) {
  let row = "";
  for (let x = 0; x < 32; x++) row += glyph(x, y, r.gx, r.gy);
  if (row.replace(/[#.]/g, "").length || y >= 14) console.log(String(y).padStart(2), row);
}

const dirs: Direction[] = ["up", "down", "left", "right"];
type N = { r: typeof r; seq: string };
const q: N[] = [{ r: cloneMsCc1SimulationRunner(r), seq: "" }];
const seen = new Set<string>([`${r.gx},${r.gy}`]);
const cells: string[] = [];
let nodes = 0;
while (q.length && nodes < 50_000) {
  const f = q.shift()!;
  nodes++;
  if (f.r.playerState.keys.includes("key_red")) {
    console.log("FOUND RED", f.seq, `${f.r.gx},${f.r.gy}`);
    break;
  }
  if (f.seq.length >= 60) continue;
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(f.r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}|${n.playerState.keys.join("+")}|${n.playerState.tools.join("+")}`;
    if (seen.has(k)) continue;
    seen.add(k);
    cells.push(`${n.gx},${n.gy}`);
    q.push({ r: n, seq: f.seq + d[0]!.toUpperCase() });
  }
  // also try one wait
  const w = cloneMsCc1SimulationRunner(f.r);
  stepMsCc1Wait(w);
  if (!w.playerDied) {
    const k = `W${w.gx},${w.gy}|${w.monsters.map((m) => `${m.x},${m.y}`).join(";")}`;
    if (!seen.has(k) && f.seq.length < 40) {
      seen.add(k);
      q.push({ r: w, seq: f.seq + "W" });
    }
  }
}
console.log({ nodes, uniquePos: new Set(cells).size, seen: seen.size, q: q.length });
console.log("positions", [...new Set(cells)].sort().join(" "));
