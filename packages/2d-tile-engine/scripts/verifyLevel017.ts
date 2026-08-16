/**
 * Re-verify level-017.json under documented autoplayRng Math.random seed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

function deterministicAutoplayChoice(
  levelNumber: number,
  stepIndex: number,
  modulo: number,
): number {
  if (modulo <= 0) return 0;
  let x = (levelNumber * 374761393 + stepIndex * 668265263) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return x % modulo;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pack = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1",
);

const level = JSON.parse(
  readFileSync(path.join(pack, "levels/level-017.json"), "utf8"),
) as LevelData;
normalizeLevelLayers(level);

const sol = JSON.parse(
  readFileSync(path.join(pack, "data/cc1-ms-solutions/level-017.json"), "utf8"),
) as {
  moves: string[];
  rngSeed: number;
  simulatedSecondsRemaining: number;
};

const map: Record<string, Direction | "wait"> = {
  U: "up",
  D: "down",
  L: "left",
  R: "right",
  W: "wait",
};

function run(seed: number) {
  const orig = Math.random;
  let step = 0;
  Math.random = () => deterministicAutoplayChoice(seed, step++, 0x10000000) / 0x10000000;
  try {
    const runner = createMsCc1SimulationRunner(structuredClone(level));
    for (const letter of sol.moves) {
      const a = map[letter]!;
      if (a === "wait") stepMsCc1Wait(runner);
      else stepMsCc1Simulation(runner, a);
      if (runner.completed || runner.playerDied) break;
    }
    return {
      completed: runner.completed,
      died: runner.playerDied,
      death: runner.deathMessage,
      rem: msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary),
      ticks: runner.buttonPressCtx.moveBoundary,
      chips: runner.playerState.chipsRemainingOnMap,
      pos: `${runner.gx},${runner.gy}`,
      rngCalls: step,
    };
  } finally {
    Math.random = orig;
  }
}

const a = run(sol.rngSeed);
const b = run(sol.rngSeed);
console.log("run1", a);
console.log("run2", b);
console.log("match", JSON.stringify(a) === JSON.stringify(b));
console.log("expected rem", sol.simulatedSecondsRemaining);

// Without seed (native Math.random) — how often does it pass?
let ok = 0;
for (let i = 0; i < 100; i++) {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  for (const letter of sol.moves) {
    const a = map[letter]!;
    if (a === "wait") stepMsCc1Wait(runner);
    else stepMsCc1Simulation(runner, a);
    if (runner.completed || runner.playerDied) break;
  }
  if (runner.completed) ok++;
}
console.log("native Math.random success rate", ok, "/100");
