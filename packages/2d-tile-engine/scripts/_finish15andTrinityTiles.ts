/** Inspect tiles around Trinity 11,18; Elementary 760→793 delta; shortest path pad to rem 89. */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import { tryMsCc1Move, msCc1StateFromRun } from "../engine/msCc1/msCc1Movement.js";
import type { Direction, LevelData } from "../engine/types.js";
import { readLevelSolution } from "../integration/solutionStorage.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

{
  const level = load(11);
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of ["down", "left", "left", "left", "down", "up"] as Direction[]) {
    stepMsCc1Simulation(r, d);
  }
  console.log("trinity pos", r.gx, r.gy);
  for (const [x, y] of [
    [10, 18],
    [11, 18],
    [12, 18],
    [11, 17],
    [11, 19],
    [9, 18],
    [13, 18],
  ] as const) {
    console.log(
      `${x},${y}`,
      "comp",
      getCompositeTile(r.level, x, y),
      "upper",
      cellTile(r.level, "upper", x, y),
      "floor",
      cellTile(r.level, "lower", x, y),
      "force",
      getForceFloorTileAt(r.level, x, y),
    );
  }
  const st = r.playerState;
  for (const d of ["left", "right", "up", "down"] as Direction[]) {
    const lvl = structuredClone(r.level);
    const mv = tryMsCc1Move(lvl, { x: r.gx, y: r.gy }, d, { ...st, keys: [...st.keys], tools: [...st.tools] });
    console.log("tryMs", d, "moved", mv.moved, "pos", mv.position, "died", mv.playerDied, "steps", mv.steps?.length);
  }
}

{
  const level = load(15);
  const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of tws.slice(0, 761)) stepMsCc1Simulation(r, d); // through chips0 move (index 760)
  function snap(r: ReturnType<typeof createMsCc1SimulationRunner>) {
    const doors: string[] = [];
    const blocks: string[] = [];
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const t = getCompositeTile(r.level, x, y);
        if (t?.includes("door") || t?.includes("lock") || t === "socket") doors.push(`${x},${y}:${t}`);
        if (t === "block_movable") blocks.push(`${x},${y}`);
      }
    }
    return {
      pos: `${r.gx},${r.gy}`,
      chips: r.playerState.chipsRemainingOnMap,
      keys: r.playerState.keys,
      tools: r.playerState.tools,
      ticks: r.buttonPressCtx.moveBoundary,
      trap: isTrapOpen(r.buttonPressCtx, 16, 16),
      blocks,
      doors: doors.sort().join(" "),
    };
  }
  const a = snap(r);
  const r2 = cloneMsCc1SimulationRunner(r);
  for (const d of tws.slice(761, 793)) stepMsCc1Simulation(r2, d);
  const b = snap(r2);
  console.log("at761", a);
  console.log("at793", b);
  console.log("path761-793", encodeSolutionMoves(tws.slice(761, 793)).join(""));

  const dirs: Direction[] = ["up", "down", "left", "right"];
  // shortest path 761 state → 14,11 without changing block
  type N = { r: typeof r; seq: Direction[] };
  const q: N[] = [{ r: cloneMsCc1SimulationRunner(r), seq: [] }];
  const seen = new Set([`${r.gx},${r.gy}`]);
  let found: Direction[] | null = null;
  let nodes = 0;
  while (q.length && nodes < 20_000) {
    const f = q.shift()!;
    nodes++;
    if (f.r.gx === 14 && f.r.gy === 11) {
      found = f.seq;
      break;
    }
    if (f.seq.length >= 40) continue;
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(f.r);
      const before = `${n.gx},${n.gy}`;
      stepMsCc1Simulation(n, d);
      if (n.playerDied) continue;
      if (`${n.gx},${n.gy}` === before) continue;
      // reject block moves
      let blk = "";
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++)
          if (getCompositeTile(n.level, x, y) === "block_movable") blk = `${x},${y}`;
      if (blk !== "18,13") continue;
      const k = `${n.gx},${n.gy}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ r: n, seq: [...f.seq, d] });
    }
  }
  console.log("shortest to 14,11", found && encodeSolutionMoves(found).join(""), "len", found?.length, "nodes", nodes);

  if (found) {
    const TIME = 250;
    const BOLD = 89;
    const TARGET = (TIME - BOLD) * 5;
    const exit: Direction[] = decodeSolutionMoves([..."DRRUUUDDDDDDDD"]) as Direction[];
    const prefix = tws.slice(0, 761);
    // pad with UD at 14,11 if needed
    const base = [...prefix, ...found];
    const rBase = createMsCc1SimulationRunner(structuredClone(level));
    for (const d of [...base, ...exit]) stepMsCc1Simulation(rBase, d);
    console.log("short+exit", {
      done: rBase.completed,
      died: rBase.playerDied,
      ticks: rBase.buttonPressCtx.moveBoundary,
      rem: msSecondsRemaining(TIME, rBase.buttonPressCtx.moveBoundary),
      need: TARGET,
    });
    if (rBase.completed && !rBase.playerDied) {
      let pad: Direction[] = [];
      let ticks = rBase.buttonPressCtx.moveBoundary;
      while (ticks < TARGET) {
        pad.push("up", "down");
        const trial = [...prefix, ...found, ...pad, ...exit];
        const rt = createMsCc1SimulationRunner(structuredClone(level));
        for (const d of trial) stepMsCc1Simulation(rt, d);
        if (!rt.completed || rt.playerDied) {
          console.log("pad failed", pad.length, rt.deathMessage);
          break;
        }
        ticks = rt.buttonPressCtx.moveBoundary;
        console.log("pad", pad.length, "ticks", ticks, "rem", msSecondsRemaining(TIME, ticks));
        if (ticks === TARGET) {
          const letters = encodeSolutionMoves(trial);
          const webPath = path.join(
            root,
            "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
          );
          writeFileSync(
            webPath,
            `${JSON.stringify(
              {
                levelId: "level-015",
                passwordMs: "COZQ",
                title: "Elementary",
                timeLimitSeconds: 250,
                boldTimeRemaining: 89,
                minChipMoves: 161,
                moves: letters,
                source: "https://scores.bitbusters.club/levels/cc1/15/ms",
                walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
                boldRouteHint:
                  "SW flippers+blue; water+force; fire+ice; thief slide; hold brown → exit",
                moveVerified: true,
                meetsBoldBudget: true,
                moveSource: "TWS to chips0 + shortest to brown setup + UD pad + hold-brown exit; exact 89",
                simulatedTicks: ticks,
                simulatedSecondsRemaining: 89,
              },
              null,
              2,
            )}\n`,
          );
          console.log("WROTE exact 89", webPath, "moves", letters.length);
          break;
        }
        if (ticks > TARGET) {
          console.log("overshot", ticks);
          break;
        }
      }
    }
  }
}
