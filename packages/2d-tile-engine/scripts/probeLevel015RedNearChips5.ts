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

// cut chips5 first time chips<=5 with skates after ice
const rs = createMsCc1SimulationRunner(structuredClone(level));
let cut = -1;
let ice = -1;
for (let i = 0; i < saved.letters.length; i++) {
  const ch = saved.letters[i]!;
  if (ch === "W") stepMsCc1Wait(rs);
  else
    stepMsCc1Simulation(
      rs,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
  if (
    ice < 0 &&
    rs.playerState.tools.includes("ice_skates") &&
    rs.playerState.chipsRemainingOnMap === 6
  )
    ice = i + 1;
  if (
    ice > 0 &&
    cut < 0 &&
    rs.playerState.chipsRemainingOnMap === 5 &&
    rs.gx === 18 &&
    rs.gy === 6
  ) {
    cut = i + 1;
    break;
  }
}
const start = createMsCc1SimulationRunner(structuredClone(level));
for (let i = 0; i < cut; i++) {
  const ch = saved.letters[i]!;
  if (ch === "W") stepMsCc1Wait(start);
  else
    stepMsCc1Simulation(
      start,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
}
console.log("chips5", [start.gx, start.gy], start.playerState.keys, start.playerState.tools);
for (let y = 1; y <= 10; y++) {
  let row = "";
  for (let x = 12; x <= 22; x++) {
    const c = getCompositeTile(start.level, x, y);
    const mark = x === start.gx && y === start.gy ? "@" : "";
    const short =
      c === "floor"
        ? "."
        : c === "wall"
          ? "#"
          : c === "ice"
            ? "I"
            : c.startsWith("force")
              ? "F"
              : c === "key_red"
                ? "r"
                : c === "key_blue"
                  ? "b"
                  : c === "fire"
                    ? "*"
                    : c === "water"
                      ? "~"
                      : c[0]?.toUpperCase() ?? "?";
    row += (mark + short).padStart(2, " ");
  }
  console.log(String(y).padStart(2), row);
}

// shortest to red key
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
const q: { r: Runner; d: number }[] = [{ r: start, d: 0 }];
const seen = new Set<string>([`${start.gx},${start.gy}|${start.playerState.keys.join("+")}`]);
let qi = 0;
while (qi < q.length) {
  const { r, d } = q[qi++]!;
  if (r.playerState.keys.includes("key_red")) {
    console.log("red in", d, "at", [r.gx, r.gy], "keys", r.playerState.keys);
    break;
  }
  for (const dir of dirs) {
    const n = cloneMsCc1SimulationRunner(r);
    stepMsCc1Simulation(n, dir);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}|${n.playerState.keys.join("+")}`;
    if (seen.has(k)) continue;
    seen.add(k);
    q.push({ r: n, d: d + 1 });
  }
}
console.log("seen", seen.size);
