/**
 * Manual Lesson 5 route from StrategyWiki / GameFAQs / BitBusters:
 * trap pink ball, get red key, brown buttons, exit. Exact bold = 85.
 */
import { writeFileSync } from "fs";
import { readFileSync } from "fs";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { Direction, LevelData } from "../engine/types.js";

type Action = Direction | "wait";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

function expand(compact: string): Action[] {
  // e.g. "2U 3L W W R" or "UUULL"
  const out: Action[] = [];
  const tokens = compact.trim().split(/\s+/);
  for (const tok of tokens) {
    if (/^W+$/i.test(tok)) {
      for (const _ of tok) out.push("wait");
      continue;
    }
    const m = /^(\d+)?([UDLRWudlrw])$/.exec(tok);
    if (m) {
      const n = m[1] ? Number(m[1]) : 1;
      const ch = m[2]!.toUpperCase();
      for (let i = 0; i < n; i++) {
        if (ch === "W") out.push("wait");
        else if (ch === "U") out.push("up");
        else if (ch === "D") out.push("down");
        else if (ch === "L") out.push("left");
        else out.push("right");
      }
      continue;
    }
    for (const ch of tok.toUpperCase()) {
      if (ch === "W") out.push("wait");
      else if (ch === "U") out.push("up");
      else if (ch === "D") out.push("down");
      else if (ch === "L") out.push("left");
      else if (ch === "R") out.push("right");
    }
  }
  return out;
}

function play(actions: Action[], label: string) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  const letters: string[] = [];
  for (const a of actions) {
    if (a === "wait") {
      stepMsCc1Wait(r);
      letters.push("W");
    } else {
      stepMsCc1Simulation(r, a);
      letters.push(LETTER[a]);
    }
    if (r.playerDied || r.completed) break;
  }
  const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
  const fires = r.monsters.filter((m) => m.alive && m.kind === "fireball");
  console.log(label, {
    completed: r.completed,
    died: r.playerDied,
    death: r.deathMessage,
    pos: `${r.gx},${r.gy}`,
    keys: r.playerState.keys,
    rem,
    ticks: r.buttonPressCtx.moveBoundary,
    toggle: getCompositeTile(r.level, 16, 15),
    fires: fires.map((f) => `${f.x},${f.y}`),
    letters: letters.length,
  });
  return { r, letters, rem };
}

// Start 20,19. Corridor up is x=21.
// Path to green button at 16,13: up to y=13, left across.
const routeA = expand(`
  U U R U U U U
  L L L L L
  W
  L
  R
  R R R R R
  D D D D D D
  L L L L L L
  U
`);

play(routeA, "routeA-probe");

// More careful: hit green, wait for ball west of toggle, hit green again, then key.
const routeB = expand(`
  2U R 4U 5L
  W W W W
  L
  W W
  R
  5R 6D 6L U
`);
play(routeB, "routeB-probe");

// From GameFAQs: up, green, green again when ball trapped, key, door, browns.
// Try denser waits around toggle.
const routeC = expand(`
  2U R 4U 5L L
  4W
  R
  2W
  L
  8W
  R 5R 7D 6L U U
`);
const c = play(routeC, "routeC-probe");

if (c.r.playerState.keys.includes("red") && !c.r.playerDied) {
  console.log("got key — extending");
}
