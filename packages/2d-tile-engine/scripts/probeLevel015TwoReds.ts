import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
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

// cut chips4
const rs = createMsCc1SimulationRunner(structuredClone(level));
let cut = -1;
for (let i = 0; i < saved.letters.length; i++) {
  const ch = saved.letters[i]!;
  if (ch === "W") stepMsCc1Wait(rs);
  else
    stepMsCc1Simulation(
      rs,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
  if (rs.playerState.chipsRemainingOnMap === 4 && rs.gx === 13 && rs.gy === 1) {
    cut = i + 1;
    break;
  }
}
const start = apply(saved.letters.slice(0, cut));
console.log("chips4", [start.gx, start.gy], start.playerState.keys, start.playerState.tools);
for (let y = 0; y < 32; y++)
  for (let x = 0; x < 32; x++) {
    const c = getCompositeTile(start.level, x, y);
    if (String(c).startsWith("key_")) console.log("key", x, y, c);
  }

// BFS to each red
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
function reach(goal: (r: Runner) => boolean, label: string) {
  const q: Runner[] = [start];
  const seen = new Set<string>();
  const k0 = (r: Runner) =>
    `${r.gx},${r.gy}|${r.playerState.keys.join("+")}|${r.playerState.chipsRemainingOnMap}`;
  seen.add(k0(start));
  let qi = 0;
  while (qi < q.length && qi < 50000) {
    const r = q[qi++]!;
    if (goal(r)) {
      console.log(label, "OK at", [r.gx, r.gy], "keys", r.playerState.keys, "d", qi);
      return r;
    }
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(r);
      stepMsCc1Simulation(n, d);
      if (n.playerDied) continue;
      const k = k0(n);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push(n);
    }
  }
  console.log(label, "FAIL seen", seen.size);
  return null;
}

const one = reach((r) => r.playerState.keys.filter((k) => k === "key_red").length >= 1, "1red");
if (one) {
  // from one, get second
  const q: Runner[] = [one];
  const seen = new Set<string>();
  const k0 = (r: Runner) =>
    `${r.gx},${r.gy}|${r.playerState.keys.join("+")}|${r.playerState.chipsRemainingOnMap}`;
  seen.add(k0(one));
  let qi = 0;
  while (qi < q.length && qi < 80000) {
    const r = q[qi++]!;
    if (r.playerState.keys.filter((k) => k === "key_red").length >= 2) {
      console.log("2red OK at", [r.gx, r.gy], "keys", r.playerState.keys);
      break;
    }
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(r);
      stepMsCc1Simulation(n, d);
      if (n.playerDied) continue;
      const k = k0(n);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push(n);
    }
  }
  if (qi >= q.length) console.log("2red FAIL from first, seen", seen.size);
}
