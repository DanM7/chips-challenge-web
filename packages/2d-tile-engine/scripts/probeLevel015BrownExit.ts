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

const start = apply(saved.letters);
console.log({
  pos: [start.gx, start.gy],
  keys: start.playerState.keys,
  rem: msSecondsRemaining(250, start.buttonPressCtx.moveBoundary),
});
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++)
    if (getCompositeTile(start.level, x, y) === "block_movable") console.log("block", x, y);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function k(r: Runner) {
  let blk = "";
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") blk += `${x},${y};`;
  return `${r.gx},${r.gy}|${r.playerState.keys.join("+")}|${blk}|${cellTile(r.level, "upper", 16, 11)}|${isTrapOpen(r.buttonPressCtx, 16, 16)}`;
}

type Node = { r: Runner; parent: number; dir: Direction | null };
const nodes: Node[] = [{ r: start, parent: -1, dir: null }];
const seen = new Set([k(start)]);
let qi = 0;
let brown: number | null = null;
let exitGe89: number | null = null;
let exitAny: number | null = null;
while (qi < nodes.length && qi < 400000) {
  const cur = nodes[qi]!;
  if (brown === null && getCompositeTile(cur.r.level, 16, 9) === "block_movable") {
    brown = qi;
    console.log("BROWN", qi, "len path later", "rem", msSecondsRemaining(250, cur.r.buttonPressCtx.moveBoundary), "at", [cur.r.gx, cur.r.gy]);
  }
  if (cur.r.completed && !cur.r.playerDied) {
    const rem = msSecondsRemaining(250, cur.r.buttonPressCtx.moveBoundary);
    if (exitAny === null) {
      exitAny = qi;
      console.log("EXIT any", rem, "ticks", cur.r.buttonPressCtx.moveBoundary, "brown", getCompositeTile(cur.r.level, 16, 9), "trap", isTrapOpen(cur.r.buttonPressCtx, 16, 16));
    }
    if (exitGe89 === null && rem >= 89) {
      exitGe89 = qi;
      console.log("EXIT >=89", rem, "ticks", cur.r.buttonPressCtx.moveBoundary, "brown", getCompositeTile(cur.r.level, 16, 9));
      break;
    }
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(cur.r);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const key = k(n);
    if (seen.has(key)) continue;
    seen.add(key);
    nodes.push({ r: n, parent: qi, dir: d });
  }
  qi++;
}
console.log("done qi", qi, "seen", seen.size, "brown", brown, "exit89", exitGe89, "exitAny", exitAny);

function pathTo(idx: number): Direction[] {
  const seq: Direction[] = [];
  let i = idx;
  while (nodes[i]!.parent >= 0) {
    seq.push(nodes[i]!.dir!);
    i = nodes[i]!.parent;
  }
  seq.reverse();
  return seq;
}

if (exitGe89 !== null) {
  const seq = pathTo(exitGe89);
  const letters = [...saved.letters, ...encodeSolutionMoves(seq)];
  const r = apply(letters);
  writeFileSync(
    ".tmp/level015-bold-letters.json",
    JSON.stringify(
      {
        letters,
        label: "exit89",
        rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
        ticks: r.buttonPressCtx.moveBoundary,
      },
      null,
      2,
    ),
  );
  console.log("saved exit89", {
    rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
    len: seq.length,
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
  });
} else if (brown !== null) {
  const seq = pathTo(brown);
  console.log("brown path len", seq.length);
}
