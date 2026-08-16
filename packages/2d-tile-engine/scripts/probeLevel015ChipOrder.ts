import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile } from "../engine/levelRuntime.js";
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
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of saved.letters) {
  if (ch === "W") stepMsCc1Wait(start);
  else
    stepMsCc1Simulation(
      start,
      (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
    );
}

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];
const k = (r: Runner) =>
  `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${r.playerState.keys.join("+")}|${r.playerState.tools.join("+")}`;

function reach(goal: (r: Runner) => boolean, label: string) {
  const q: Runner[] = [start];
  const seen = new Set([k(start)]);
  let qi = 0;
  while (qi < q.length && qi < 80000) {
    const r = q[qi++]!;
    if (goal(r)) {
      console.log(label, "OK", [r.gx, r.gy], "chips", r.playerState.chipsRemainingOnMap, "keys", r.playerState.keys);
      return;
    }
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(r);
      stepMsCc1Simulation(n, d);
      if (n.playerDied) continue;
      const key = k(n);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push(n);
    }
  }
  console.log(label, "FAIL seen", seen.size);
}

reach((r) => r.gx === 16 && r.gy === 19, "at1619");
reach((r) => cellTile(r.level, "upper", 16, 19) !== "chip", "took1619");
reach((r) => cellTile(r.level, "upper", 13, 27) !== "chip", "took1327");
reach(
  (r) =>
    cellTile(r.level, "upper", 16, 19) !== "chip" &&
    cellTile(r.level, "upper", 13, 27) !== "chip",
  "tookBoth",
);

// After taking 1327 only, can we take 1619?
{
  const q: Runner[] = [start];
  const seen = new Set([k(start)]);
  let qi = 0;
  let after: Runner | null = null;
  while (qi < q.length && qi < 80000) {
    const r = q[qi++]!;
    if (cellTile(r.level, "upper", 13, 27) !== "chip" && cellTile(r.level, "upper", 16, 19) === "chip") {
      after = r;
      break;
    }
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(r);
      stepMsCc1Simulation(n, d);
      if (n.playerDied) continue;
      const key = k(n);
      if (seen.has(key)) continue;
      seen.add(key);
      q.push(n);
    }
  }
  console.log("after1327", after && [after.gx, after.gy]);
  if (after) {
    const q2: Runner[] = [after];
    const seen2 = new Set([k(after)]);
    let qj = 0;
    let ok = false;
    while (qj < q2.length && qj < 80000) {
      const r = q2[qj++]!;
      if (cellTile(r.level, "upper", 16, 19) !== "chip") {
        ok = true;
        console.log("then1619 OK", [r.gx, r.gy]);
        break;
      }
      for (const d of dirs) {
        const n = cloneMsCc1SimulationRunner(r);
        stepMsCc1Simulation(n, d);
        if (n.playerDied) continue;
        const key = k(n);
        if (seen2.has(key)) continue;
        seen2.add(key);
        q2.push(n);
      }
    }
    if (!ok) console.log("then1619 FAIL seen", seen2.size);
  }
}
