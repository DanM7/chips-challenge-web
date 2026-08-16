/**
 * Finish Elementary (exact 89), Trinity red-key-with-waits, Hunt serpentine probe.
 */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);
const dirs: Direction[] = ["up", "down", "left", "right"];

function load(n: number): LevelData {
  const level = JSON.parse(
    readFileSync(
      path.join(
        root,
        `../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(n).padStart(3, "0")}.json`,
      ),
      "utf8",
    ),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function writeWeb(
  n: number,
  extra: Record<string, unknown>,
) {
  const id = String(n).padStart(3, "0");
  const prev = JSON.parse(readFileSync(path.join(webSol, `level-${id}.json`), "utf8"));
  writeFileSync(path.join(webSol, `level-${id}.json`), `${JSON.stringify({ ...prev, ...extra }, null, 2)}\n`);
  console.log("wrote", n, extra.moveSource, extra.simulatedSecondsRemaining);
}

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;

function blockPos(r: Runner): string {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "gone";
}

// ---------- 15: from chips0 through thief to exit ----------
{
  const level = load(15);
  const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
  const start = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of tws.slice(0, 761)) stepMsCc1Simulation(start, d);
  const thieves: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(start.level, x, y) === "thief") thieves.push(`${x},${y}`);
  console.log("15 chips0", `${start.gx},${start.gy}`, "thieves", thieves, "tools", start.playerState.tools, "ticks", start.buttonPressCtx.moveBoundary);

  function key(r: Runner): string {
    return `${r.gx},${r.gy}|${r.playerState.tools.length}|${blockPos(r)}|${r.playerState.keys.join("+")}|${isTrapOpen(r.buttonPressCtx, 16, 16)}|${cellTile(r.level, "upper", 16, 15)}|${cellTile(r.level, "upper", 16, 11)}|${cellTile(r.level, "upper", 16, 10)}`;
  }

  type N = { r: Runner; seq: Direction[] };
  const q: N[] = [{ r: start, seq: [] }];
  const seen = new Set([key(start)]);
  let nodes = 0;
  let best: { seq: Direction[]; rem: number; ticks: number } | null = null;
  const t0 = Date.now();
  while (q.length && nodes < 250_000) {
    const f = q.shift()!;
    nodes++;
    if (f.r.completed) {
      const rem = msSecondsRemaining(250, f.r.buttonPressCtx.moveBoundary);
      if (!best || rem > best.rem) {
        best = { seq: f.seq, rem, ticks: f.r.buttonPressCtx.moveBoundary };
        console.log("15 exit", rem, "ticks", f.r.buttonPressCtx.moveBoundary, "len", f.seq.length, "nodes", nodes);
        if (rem >= 89) {
          // keep searching a bit for exact
          if (rem === 89) break;
        }
      }
      continue;
    }
    if (f.seq.length >= 55) continue;
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(f.r);
      stepMsCc1Simulation(n, d);
      if (n.playerDied) continue;
      const k = key(n);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ r: n, seq: [...f.seq, d] });
    }
  }
  console.log("15 bfs", { nodes, seen: seen.size, best, ms: Date.now() - t0 });

  if (best) {
    const prefix = tws.slice(0, 761);
    let full = [...prefix, ...best.seq];
    const TARGET = 805;
    if (best.ticks < TARGET) {
      // insert UD pads just before the last 8 moves if possible
      const body = best.seq.slice(0, Math.max(0, best.seq.length - 8));
      const tail = best.seq.slice(Math.max(0, best.seq.length - 8));
      let pad: Direction[] = [];
      while (true) {
        const trial = [...prefix, ...body, ...pad, ...tail];
        const rt = createMsCc1SimulationRunner(structuredClone(level));
        for (const d of trial) stepMsCc1Simulation(rt, d);
        if (!rt.completed || rt.playerDied) {
          console.log("15 pad broke", pad.length);
          break;
        }
        console.log("15 pad", pad.length, "ticks", rt.buttonPressCtx.moveBoundary, "rem", msSecondsRemaining(250, rt.buttonPressCtx.moveBoundary));
        if (rt.buttonPressCtx.moveBoundary === TARGET) {
          full = trial;
          best = { seq: [...body, ...pad, ...tail], rem: 89, ticks: TARGET };
          break;
        }
        if (rt.buttonPressCtx.moveBoundary > TARGET) break;
        pad.push("left", "right");
        if (pad.length > 40) break;
      }
    }
    const rt = createMsCc1SimulationRunner(structuredClone(level));
    for (const d of full) stepMsCc1Simulation(rt, d);
    const rem = msSecondsRemaining(250, rt.buttonPressCtx.moveBoundary);
    if (rt.completed && rem >= 89) {
      writeWeb(15, {
        moves: encodeSolutionMoves(full),
        moveVerified: rem === 89,
        meetsBoldBudget: rem >= 89,
        simulatedTicks: rt.buttonPressCtx.moveBoundary,
        simulatedSecondsRemaining: rem,
        moveSource: `TWS to chips0 + BFS exit; rem ${rem} (bold 89)`,
        boldGapNote: rem === 89 ? undefined : `rem ${rem} vs bold 89`,
      });
    }
  }
}

// ---------- 11: from D3LD, BFS with waits for red key then rest ----------
{
  const level = load(11);
  const start = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of ["down", "left", "left", "left", "down"] as Direction[]) stepMsCc1Simulation(start, d);
  console.log("\n11 start", `${start.gx},${start.gy}`);

  // walk west along y=20
  let walk = cloneMsCc1SimulationRunner(start);
  const west: string[] = [];
  for (let i = 0; i < 20; i++) {
    const before = `${walk.gx},${walk.gy}`;
    stepMsCc1Simulation(walk, "left");
    west.push(`${before}-L->${walk.gx},${walk.gy}${walk.playerDied ? " DIE" : ""}`);
    if (walk.playerDied || `${walk.gx},${walk.gy}` === before) break;
  }
  console.log("west", west.join(" | "));
  console.log("at", `${walk.gx},${walk.gy}`, "force", getForceFloorTileAt(walk.level, walk.gx, walk.gy));

  type N = { r: Runner; seq: string };
  const q: N[] = [{ r: cloneMsCc1SimulationRunner(start), seq: "" }];
  const seen = new Set([`${start.gx},${start.gy}|${start.monsters.map((m) => `${m.x},${m.y},${m.direction}`).join(";")}`]);
  let nodes = 0;
  let found: { seq: string; r: Runner } | null = null;
  const t0 = Date.now();
  while (q.length && nodes < 400_000) {
    const f = q.shift()!;
    nodes++;
    if (f.r.playerState.keys.includes("key_red")) {
      found = f;
      console.log("11 RED", f.seq, `${f.r.gx},${f.r.gy}`, "nodes", nodes);
      break;
    }
    if (f.seq.length >= 70) continue;
    for (const wait of [false, true]) {
      for (const d of dirs) {
        const n = cloneMsCc1SimulationRunner(f.r);
        if (wait) {
          stepMsCc1Wait(n);
          if (n.playerDied) continue;
        }
        stepMsCc1Simulation(n, d);
        if (n.playerDied) continue;
        const k = `${n.gx},${n.gy}|${n.playerState.keys.join("+")}|${n.monsters.map((m) => `${m.x},${m.y},${m.direction}`).join(";")}`;
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({ r: n, seq: f.seq + (wait ? "W" : "") + d[0]!.toUpperCase() });
      }
    }
  }
  console.log("11 red bfs", { nodes, seen: seen.size, found: found?.seq ?? null, ms: Date.now() - t0 });
}
