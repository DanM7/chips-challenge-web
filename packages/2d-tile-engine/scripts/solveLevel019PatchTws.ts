import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-019.json",
);
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

const DIRS: Direction[] = ["up", "down", "left", "right"];
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};
const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { direction: number }[] };
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const tws = sol.twsRecords
  .map((r) => TWS_DIR[r.direction])
  .filter((d): d is Direction => !!d);

function apply(r: MsCc1SimulationRunner, d: Direction): MsCc1SimulationRunner {
  const n = cloneMsCc1SimulationRunner(r);
  stepMsCc1Simulation(n, d);
  return n;
}

function key(r: MsCc1SimulationRunner): string {
  const m = r.monsters
    .filter((x) => x.alive)
    .map((x) => `${x.x},${x.y}${x.direction[0]}`)
    .join(";");
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${m}|${r.buttonPressCtx.moveBoundary % 2}`;
}

/** Follow TWS until death; at each death, BFS a detour that rejoins later TWS index or continues. */
function patchTws(parity: "even" | "odd"): Direction[] | null {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  const out: Direction[] = [];
  let i = 0;
  let patches = 0;

  while (i < tws.length) {
    const trial = apply(r, tws[i]!);
    if (!trial.playerDied) {
      stepMsCc1Simulation(r, tws[i]!);
      out.push(tws[i]!);
      i++;
      if (r.completed) return out;
      continue;
    }

    // Death on tws[i] — search short detour
    patches++;
    console.log(
      parity,
      "patch at",
      i,
      `${r.gx},${r.gy}`,
      "chips",
      r.playerState.chipsRemainingOnMap,
      "mb",
      r.buttonPressCtx.moveBoundary,
    );
    type Item = { r: MsCc1SimulationRunner; path: Direction[]; rejoined?: number };
    const q: Item[] = [{ r: cloneMsCc1SimulationRunner(r), path: [] }];
    const seen = new Set([key(r)]);
    let found: Item | null = null;
    let expanded = 0;
    while (q.length && expanded < 300_000) {
      const cur = q.shift()!;
      expanded++;
      if (cur.path.length > 40) continue;

      // Success if completed
      if (cur.r.completed) {
        found = cur;
        break;
      }

      // Rejoin: after detour, next few TWS moves work
      for (let ahead = 1; ahead <= 8; ahead++) {
        if (i + ahead >= tws.length) break;
        let ok = true;
        let rr = cloneMsCc1SimulationRunner(cur.r);
        for (let k = 0; k < ahead; k++) {
          stepMsCc1Simulation(rr, tws[i + k]!);
          if (rr.playerDied) {
            ok = false;
            break;
          }
          if (rr.completed) break;
        }
        // Prefer rejoining at i+1 after surviving the deadly move differently
        if (ok && cur.path.length > 0) {
          // Check if we can skip the deadly move and continue from i+1
          let rr2 = cloneMsCc1SimulationRunner(cur.r);
          let ok2 = true;
          for (let k = 1; k <= 3 && i + k < tws.length; k++) {
            stepMsCc1Simulation(rr2, tws[i + k]!);
            if (rr2.playerDied) {
              ok2 = false;
              break;
            }
          }
          if (ok2) {
            found = { ...cur, rejoined: i + 1 };
            break;
          }
        }
      }

      // Also accept if chips decreased a lot safely
      if (
        cur.path.length >= 3 &&
        cur.r.playerState.chipsRemainingOnMap < r.playerState.chipsRemainingOnMap - 2
      ) {
        // continue search but remember
        if (!found) found = cur;
      }

      for (const d of DIRS) {
        const nr = apply(cur.r, d);
        if (nr.playerDied) continue;
        if (nr.gx === cur.r.gx && nr.gy === cur.r.gy) continue;
        const k = key(nr);
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({ r: nr, path: [...cur.path, d] });
      }
    }

    if (!found || found.path.length === 0) {
      console.log(parity, "no patch found", { expanded });
      return null;
    }

    console.log(
      parity,
      "applied patch len",
      found.path.length,
      "rejoin",
      found.rejoined,
      "→",
      `${found.r.gx},${found.r.gy}`,
      "chips",
      found.r.playerState.chipsRemainingOnMap,
    );

    for (const d of found.path) {
      stepMsCc1Simulation(r, d);
      out.push(d);
      if (r.playerDied) return null;
      if (r.completed) return out;
    }

    if (found.rejoined != null) {
      i = found.rejoined;
    } else {
      // skip deadly move, try next
      i++;
    }
    if (patches > 30) {
      console.log("too many patches");
      break;
    }
  }

  // If TWS exhausted but not done, BFS finish
  if (!r.completed && !r.playerDied) {
    console.log(
      parity,
      "TWS done, finishing",
      `${r.gx},${r.gy}`,
      r.playerState.chipsRemainingOnMap,
    );
    type Item = { r: MsCc1SimulationRunner; path: Direction[] };
    const q: Item[] = [{ r: cloneMsCc1SimulationRunner(r), path: [] }];
    const seen = new Set([key(r)]);
    let expanded = 0;
    while (q.length && expanded < 1_000_000) {
      const cur = q.shift()!;
      expanded++;
      if (cur.r.completed) {
        for (const d of cur.path) out.push(d);
        return out;
      }
      if (cur.path.length > 200 || cur.r.buttonPressCtx.moveBoundary > 250) continue;
      for (const d of DIRS) {
        const nr = apply(cur.r, d);
        if (nr.playerDied) continue;
        if (nr.gx === cur.r.gx && nr.gy === cur.r.gy) continue;
        const k = key(nr);
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({ r: nr, path: [...cur.path, d] });
      }
    }
    console.log(parity, "finish failed", expanded);
  }
  return r.completed ? out : null;
}

for (const parity of ["odd", "even"] as const) {
  const moves = patchTws(parity);
  if (!moves) {
    console.log(parity, "FAILED");
    continue;
  }
  const v = createMsCc1SimulationRunner(structuredClone(level));
  v.buttonPressCtx.stepParity = parity;
  for (const d of moves) {
    stepMsCc1Simulation(v, d);
    if (v.playerDied || v.completed) break;
  }
  const rem = msSecondsRemaining(210, v.buttonPressCtx.moveBoundary);
  console.log(parity, "RESULT", {
    done: v.completed,
    died: v.playerDied,
    rem,
    mb: v.buttonPressCtx.moveBoundary,
    len: moves.length,
  });
  if (v.completed) {
    const existing = JSON.parse(readFileSync(webSol, "utf8")) as Record<string, unknown>;
    const letters = moves.map((d) => LETTER[d]);
    writeFileSync(
      webSol,
      JSON.stringify(
        {
          ...existing,
          moves: letters,
          walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
          boldRouteHint: `${parity} step; patched TWS + finish`,
          moveVerified: true,
          meetsBoldBudget: rem >= 171,
          moveSource: `Patched TWS Digger ${parity}; ${rem}s remaining (bold 171)`,
          simulatedTicks: v.buttonPressCtx.moveBoundary,
          simulatedSecondsRemaining: rem,
          stepParity: parity,
        },
        null,
        2,
      ) + "\n",
    );
    console.log("WROTE rem", rem);
    if (rem === 171) break;
  }
}
