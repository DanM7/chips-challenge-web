import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

// Identify mystery tiles and teeth
console.log("=== special tiles ===");
for (let y = 0; y < level.height; y++) {
  for (let x = 0; x < level.width; x++) {
    const t = getCompositeTile(level, x, y) ?? "empty";
    if (
      t !== "wall" &&
      t !== "empty" &&
      t !== "floor" &&
      t !== "chip" &&
      t !== "dirt" &&
      t !== "gravel"
    ) {
      console.log(x, y, t);
    }
  }
}

const runner0 = createMsCc1SimulationRunner(structuredClone(level));
console.log(
  "=== monsters ===",
  runner0.monsters.map((m) => `${m.kind}@${m.x},${m.y}${m.direction[0]}`),
);

function expandRoute(route: string): Direction[] {
  const dirs: Direction[] = [];
  const re = /(\d+)?([UDLRW])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(route.replace(/\s/g, ""))) !== null) {
    const count = m[1] ? Number.parseInt(m[1], 10) : 1;
    const map: Record<string, Direction | "wait"> = {
      U: "up",
      D: "down",
      L: "left",
      R: "right",
      W: "wait",
    };
    for (let i = 0; i < count; i += 1) {
      const d = map[m[2]!];
      if (d === "wait") {
        // represent wait as special - push as up and mark? Better separate.
      }
      dirs.push(d as Direction);
    }
  }
  return dirs;
}

function expandLetters(route: string): string[] {
  const out: string[] = [];
  const re = /(\d+)?([UDLRW])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(route.replace(/\s/g, ""))) !== null) {
    const count = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < count; i++) out.push(m[2]!);
  }
  return out;
}

function simLetters(
  letters: string[],
  parity: "even" | "odd",
  stopOnDeath = true,
) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  let lastOk = 0;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i]!;
    if (ch === "W") stepMsCc1Wait(r);
    else {
      const dir =
        ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right";
      stepMsCc1Simulation(r, dir as Direction);
    }
    if (r.playerDied) {
      return {
        ok: false,
        diedAt: i + 1,
        letter: ch,
        death: r.deathMessage,
        pos: `${r.gx},${r.gy}`,
        chips: r.playerState.chipsRemainingOnMap,
        ticks: r.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
        completed: false,
        lastOk,
      };
    }
    lastOk = i + 1;
    if (r.completed) {
      return {
        ok: true,
        completed: true,
        pos: `${r.gx},${r.gy}`,
        chips: r.playerState.chipsRemainingOnMap,
        ticks: r.buttonPressCtx.moveBoundary,
        rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
        moves: i + 1,
        diedAt: null,
      };
    }
  }
  return {
    ok: !r.playerDied,
    completed: r.completed,
    pos: `${r.gx},${r.gy}`,
    chips: r.playerState.chipsRemainingOnMap,
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
    moves: letters.length,
    diedAt: null as number | null,
    death: r.deathMessage,
  };
}

// StrategyWiki partial: follow chips to exit area
// From P(3,2): down the chip column then toward exit
// Chip column at x=3 from y=3..13 = 11 downs from start y=2
// Then right along row 13 chips: from x=3 to ... looking at map row13: chips from x=3 to ~18?
// Then down to sockets/exit?

// Let's try: 11D then path to exit then 8U
const toExit = expandLetters("11D"); // to (3,13)
console.log("11D", simLetters(toExit, "odd"));

// Continue right on chips row 13: @@@@@@@@@@@@@@@@@ from x=3
// Count chips on row 13
let r13 = 0;
for (let x = 0; x < 32; x++) {
  const t = getCompositeTile(level, x, 13);
  if (t === "chip") {
    r13++;
    process.stdout.write(`${x},`);
  }
}
console.log("\nrow13 chips count", r13);

// From (3,13), chips go right. Looking: #,,@@@@@@@@@@@@@@@@,,,,,@
// positions: x=3 to x=18? Let's list
for (let x = 0; x < 32; x++) {
  const t = getCompositeTile(level, x, 13) ?? "";
  if (t === "chip") console.log("chip", x, 13);
}

// Path near exit: sockets at (11-13,14-16), exit (12,15)
// From (3,13) go right to x=12 then down? But dirt/socket blocking?
for (let y = 13; y <= 16; y++) {
  const row: string[] = [];
  for (let x = 0; x < 32; x++) {
    row.push((getCompositeTile(level, x, y) ?? ".").slice(0, 1));
  }
  console.log(y, row.join(""));
}

// Try SW opening: follow chips out to exit + 8U
// Common CC1 digger route from wiki community:
// Start down collecting, go to near exit, 8U
const openA = expandLetters("11D9R2D8U"); // guess
console.log("openA", simLetters(openA, "odd"));
const openB = expandLetters("11D9R3D8U");
console.log("openB", simLetters(openB, "odd"));
const openC = expandLetters("11D15R8U"); // stay on row13 then 8U from somewhere
console.log("openC", simLetters(openC, "odd"));

// Trace step by step near exit
function trace(letters: string[], parity: "even" | "odd" = "odd") {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = parity;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i]!;
    if (ch === "W") stepMsCc1Wait(r);
    else {
      const dir =
        ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right";
      stepMsCc1Simulation(r, dir as Direction);
    }
    const tile = getCompositeTile(r.level, r.gx, r.gy);
    console.log(
      `#${i + 1} ${ch} -> ${r.gx},${r.gy} ${tile} chips=${r.playerState.chipsRemainingOnMap} mb=${r.buttonPressCtx.moveBoundary}${r.playerDied ? " DEAD " + r.deathMessage : ""}${r.completed ? " WIN" : ""}`,
    );
    if (r.playerDied || r.completed) break;
  }
}

console.log("--- trace to exit area ---");
trace(expandLetters("11D9R"));
