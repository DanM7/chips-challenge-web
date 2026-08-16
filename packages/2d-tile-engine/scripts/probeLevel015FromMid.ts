import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
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

// Rebuild to mid using same search as script - actually letters may be partial.
// Re-run quick path to b1615 from c1619 letters in tmp - check label
console.log("label letters", saved.letters.length);

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

const r0 = apply(saved.letters);
console.log("current", {
  pos: [r0.gx, r0.gy],
  block: blockPos(r0),
  trap: isTrapOpen(r0.buttonPressCtx, 16, 16),
  tools: r0.playerState.tools,
});

// If not at mid, we need to not have overwritten - the script exited before saving mid.
// Recreate mid with BFS from c1619 cut in letters - letters should still be c1619 from failed brown write at end... 
// Actually script exited at no setup without saving. letters file is still c1619 or trap_open?

type Runner = ReturnType<typeof apply>;
const dirs: Direction[] = ["up", "down", "left", "right"];

// Assume we need to get to mid first from current if block isn't 16,15
let start = r0;
if (blockPos(start) !== "16,15") {
  const q = [start];
  const seen = new Set([`${start.gx},${start.gy}|${blockPos(start)}`]);
  let qi = 0;
  while (qi < q.length) {
    const cur = q[qi++]!;
    if (blockPos(cur) === "16,15" && isTrapOpen(cur.buttonPressCtx, 16, 16)) {
      start = cur;
      console.log("reached mid", [cur.gx, cur.gy]);
      break;
    }
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(cur);
      stepMsCc1Simulation(n, d);
      if (n.playerDied) continue;
      const k = `${n.gx},${n.gy}|${blockPos(n)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push(n);
    }
  }
}

console.log("from", {
  pos: [start.gx, start.gy],
  block: blockPos(start),
  trap: isTrapOpen(start.buttonPressCtx, 16, 16),
});

// Can we reach 16,16?
const q2 = [start];
const seen2 = new Set([`${start.gx},${start.gy}|${blockPos(start)}`]);
let qi = 0;
while (qi < q2.length && qi < 50000) {
  const cur = q2[qi++]!;
  if (cur.gx === 16 && cur.gy === 16) {
    console.log("at trap", "block", blockPos(cur));
    const up = cloneMsCc1SimulationRunner(cur);
    stepMsCc1Simulation(up, "up");
    console.log("push up", {
      pos: [up.gx, up.gy],
      block: blockPos(up),
      died: up.playerDied,
    });
    break;
  }
  if (blockPos(cur) === "16,14" && cur.gx === 16 && cur.gy === 15) {
    console.log("SETUP OK");
    break;
  }
  for (const d of dirs) {
    const n = cloneMsCc1SimulationRunner(cur);
    stepMsCc1Simulation(n, d);
    if (n.playerDied) continue;
    const k = `${n.gx},${n.gy}|${blockPos(n)}`;
    if (seen2.has(k)) continue;
    seen2.add(k);
    q2.push(n);
  }
}
console.log("seen2", seen2.size);
