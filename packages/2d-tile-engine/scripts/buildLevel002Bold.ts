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
const levelPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-002.json",
);
const engineSol = path.join(root, "integration/data/cc1-ms-solutions/level-002.json");
const webSol = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-002.json",
);
const level = JSON.parse(readFileSync(levelPath, "utf8")) as LevelData;
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
    if (runner.playerDied) {
      return {
        ok: false as const,
        died: true as const,
        death: runner.deathMessage,
        pos: { x: runner.gx, y: runner.gy },
        chips: runner.playerState.chipsRemainingOnMap,
        ticks: runner.buttonPressCtx.moveBoundary,
        monsters: runner.monsters.filter((m) => m.alive).map((m) => `${m.x},${m.y}`),
      };
    }
    if (runner.gx === before.x && runner.gy === before.y && !runner.completed) {
      const tx = before.x + (d === "left" ? -1 : d === "right" ? 1 : 0);
      const ty = before.y + (d === "up" ? -1 : d === "down" ? 1 : 0);
      return {
        ok: false as const,
        died: false as const,
        pos: before,
        ch,
        want: getCompositeTile(runner.level, tx, ty),
        lower: (runner.level.layers.lower as string[])[ty * runner.level.width + tx],
        chips: runner.playerState.chipsRemainingOnMap,
        ticks: runner.buttonPressCtx.moveBoundary,
        monsters: runner.monsters.filter((m) => m.alive).map((m) => `${m.x},${m.y}`),
      };
    }
    if (runner.completed) break;
  }
  return {
    ok: runner.completed === true,
    died: false as const,
    pos: { x: runner.gx, y: runner.gy },
    chips: runner.playerState.chipsRemainingOnMap,
    ticks: runner.buttonPressCtx.moveBoundary,
    remaining: msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary),
    moves: encodeSolutionMoves(dirs.slice(0, runner.chipMoves)),
    monsters: runner.monsters.filter((m) => m.alive).map((m) => `${m.x},${m.y}`),
    tileAt: (x: number, y: number) => getCompositeTile(runner.level, x, y),
  };
}

let route = "";
function add(label: string, segment: string) {
  const next = route + segment;
  const r = run(next);
  if (!r.ok && ("want" in r || r.died)) {
    console.error(r.died ? "DIED" : "STUCK", label, r);
    console.error("route", route, "+", segment);
    process.exit(1);
  }
  route = next;
  console.log(
    `${label.padEnd(16)} (${r.pos.x},${r.pos.y}) c=${r.chips} t=${r.ticks} rem=${"remaining" in r ? r.remaining : "?"} bugs=${r.monsters.join(" ")}${r.ok ? " DONE" : ""}`,
  );
}

// StrategyWiki: east chips, blocks 2 then 1 over TOP water, top chip, bottom chip, west exit → 90
add("east top*", "URR"); // (21,12)->(21,11)->(22,11)->(23,11)*
add("east bot*", "DD"); // (23,13)*
add("to push B2", "LLLU"); // (20,13)->push (20,12) to (20,11); Chip at (20,12)
add("around B2", "RU"); // (21,12)->(21,11)
add("push B2 W", "LLL"); // (20,11)->(19,11)->(18,11)->(17,11) water→dirt; Chip (18,11)
add("to B1", "DL"); // (18,12)->(17,12)? need to push (19,12) up — refine

const r = run(route);
console.log("partial", {
  ok: r.ok,
  pos: r.pos,
  chips: r.chips,
  ticks: r.ticks,
  rem: "remaining" in r ? r.remaining : null,
  bugs: r.monsters,
  waterBridge: "tileAt" in r ? [r.tileAt(16, 11), r.tileAt(17, 11), r.tileAt(16, 12)] : null,
});
console.log("ROUTE", route);
