import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-001.json",
);
const engineSol = path.join(root, "integration/data/cc1-ms-solutions/level-001.json");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirMap: Record<string, Direction> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};

function run(letters: string) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  const dirs: Direction[] = [];
  for (const ch of letters) {
    const d = dirMap[ch];
    if (!d) continue;
    dirs.push(d);
    const before = { x: runner.gx, y: runner.gy };
    stepMsCc1Simulation(runner, d);
    if (runner.gx === before.x && runner.gy === before.y && !runner.completed) {
      const tx = before.x + (d === "left" ? -1 : d === "right" ? 1 : 0);
      const ty = before.y + (d === "up" ? -1 : d === "down" ? 1 : 0);
      return {
        ok: false as const,
        pos: before,
        ch,
        want: getCompositeTile(runner.level, tx, ty),
        chips: runner.playerState.chipsRemainingOnMap,
        keys: [...runner.playerState.keys],
        ticks: runner.buttonPressCtx.moveBoundary,
      };
    }
    if (runner.completed || runner.playerDied) break;
  }
  return {
    ok: runner.completed === true,
    died: !!runner.playerDied,
    pos: { x: runner.gx, y: runner.gy },
    chips: runner.playerState.chipsRemainingOnMap,
    keys: [...runner.playerState.keys],
    ticks: runner.buttonPressCtx.moveBoundary,
    remaining: msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary),
    moves: encodeSolutionMoves(dirs.slice(0, runner.chipMoves)),
  };
}

let route = "";
function add(label: string, segment: string) {
  const next = route + segment;
  const r = run(next);
  if (!r.ok && "want" in r) {
    console.error("STUCK", label, r);
    console.error("route", route, "+", segment);
    process.exit(1);
  }
  route = next;
  console.log(
    `${label.padEnd(18)} (${r.pos.x},${r.pos.y}) c=${r.chips} k=[${r.keys.map((k) => k.replace("key_", "")).join(",")}] t=${r.ticks} rem=${"remaining" in r ? r.remaining : "?"}${r.ok ? " DONE" : ""}`,
  );
  return r;
}

add("opener", "LLUUL");
add("NW Y*", "LLD");
add("to13,12", "URRR");
add("B2", "DDD");
add("green+BR*", "RRRDDDDD");
// Skip center here — collect it on the BL path through (15,16).
add("R low", "UUUUUR"); // (16,20)->(16,15)->(17,15)R
add("R+east*", "UU"); // (17,14)* then (17,13)R
add("NE door", "UR"); // (17,12)(18,12)r
add("NE Y", "RR"); // (20,12)Y
add("NE *", "D"); // (20,13)*
add("to green E", "ULLL"); // (20,13)->(17,12)
add("E green*", "UUR"); // (18,10)*

// SE chip (20,15) via blue (18,16)
add("SE *", "LDDDDDDRRRU"); // (18,10)->(20,15)*

// Bottom-left with Y2; also picks center (15,16) on the way
add("BL+center*", "DLLLLLLDDD"); // (20,15)->(14,16)->y->(14,19)*

// SW chip (10,15) via red (12,16)
add("SW door", "UUULL"); // (14,19)->(14,16)->(12,16)r
add("SW *", "LLU"); // (10,16)(10,15)*

// NW top chip (12,10) via green (13,11)
add("to W green", "DRRRUU"); // (10,15)->(13,14)
add("NW top*", "UUUUL"); // (13,14)->(13,11)g->(13,10)->(12,10)*

// Exit: (12,10)->(13,10)->(13,11)->(13,12)->(14,12)->(15,12)->(15,11)S->(15,10)E
add("exit", "RDDRRUU");

const result = run(route);
console.log("\nRESULT", result);
console.log("ROUTE", route, "len", route.length);

if (result.ok && "remaining" in result) {
  const bold = result.remaining >= 83;
  const existing = JSON.parse(readFileSync(engineSol, "utf8")) as Record<string, unknown>;
  const out = {
    ...existing,
    moves: result.moves,
    moveVerified: true,
    meetsBoldBudget: bold,
    moveSource: `StrategyWiki opener (2L 2U L → green → CCW); engine-verified ${result.remaining}s left (bold 83)`,
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint: "2L 2U L, yellow/green keys, counterclockwise chips → 83 left",
    simulatedTicks: result.ticks,
    simulatedSecondsRemaining: result.remaining,
  };
  mkdirSync(path.join(root, ".tmp"), { recursive: true });
  writeFileSync(path.join(root, ".tmp/level001-bold-solution.json"), JSON.stringify(out, null, 2));
  if (bold) {
    writeFileSync(engineSol, JSON.stringify(out, null, 2) + "\n");
    copyFileSync(engineSol, webSol);
    console.log("Wrote bold solution to engine + web");
  } else {
    console.log("Completed but not bold yet; wrote .tmp only. rem=", result.remaining, "ticks=", result.ticks);
  }
}
