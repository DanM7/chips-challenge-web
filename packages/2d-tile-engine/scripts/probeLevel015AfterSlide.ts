import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
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

let r = apply(saved.letters);
// Slide out
{
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, "right");
  r = n;
}
console.log("after slide", {
  pos: [r.gx, r.gy],
  keys: r.playerState.keys,
  tools: r.playerState.tools,
  rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
  doors: {
    b16: cellTile(r.level, "upper", 16, 11),
    b18: cellTile(r.level, "upper", 18, 11),
    r16: cellTile(r.level, "upper", 16, 15),
    r18: cellTile(r.level, "upper", 18, 15),
  },
});

// Map around center 12-22, 8-22
for (let y = 8; y <= 22; y++) {
  let row = "";
  for (let x = 12; x <= 22; x++) {
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
                : c.startsWith("force")
                  ? "F"
                  : c === "block_movable"
                    ? "B"
                    : c === "key_blue"
                      ? "b"
                      : c === "key_red"
                        ? "r"
                        : c === "button_brown"
                          ? "o"
                          : c === "trap"
                            ? "t"
                            : c === "socket"
                              ? "S"
                              : c === "exit"
                                ? "X"
                                : c === "door_blue"
                                  ? "B"
                                  : c === "door_red"
                                    ? "R"
                                    : c === "fire"
                                      ? "*"
                                      : c[0]?.toUpperCase() ?? "?";
    row += (mark + short).padStart(2, " ");
  }
  console.log(String(y).padStart(2), row);
}

// BFS reachability dump: can we reach blue key / block / brown?
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function key(rr: Runner) {
  let blocks = "";
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(rr.level, x, y) === "block_movable") blocks += `${x},${y};`;
  return `${rr.gx},${rr.gy}|${rr.playerState.keys.join("+")}|${blocks}`;
}
const q: Runner[] = [r];
const seen = new Set([key(r)]);
let qi = 0;
const interesting: string[] = [];
while (qi < q.length && qi < 50000) {
  const cur = q[qi++]!;
  const tile = getCompositeTile(cur.level, cur.gx, cur.gy);
  if (cur.playerState.keys.includes("key_blue")) interesting.push(`BLUEKEY at ${cur.gx},${cur.gy}`);
  if (getCompositeTile(cur.level, 16, 9) === "block_movable")
    interesting.push(`BROWNBLOCK from ${cur.gx},${cur.gy}`);
  if (cur.gx === 18 && cur.gy === 20) interesting.push("at blue key tile");
  if (cur.completed) interesting.push(`EXIT rem ${msSecondsRemaining(250, cur.buttonPressCtx.moveBoundary)}`);
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(cur);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = key(n);
    if (seen.has(k)) continue;
    seen.add(k);
    q.push(n);
  }
}
console.log("reachable", seen.size, "interesting", [...new Set(interesting)].slice(0, 20));
// positions reachable
const positions = new Set([...seen].map((s) => s.split("|")[0]));
console.log("positions", positions.size, [...positions].sort().join(" "));
