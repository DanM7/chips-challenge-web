import { readFileSync, writeFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

type Action = Direction | "wait";
const LETTER: Record<Direction, string> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

function parse(s: string): Action[] {
  const out: Action[] = [];
  for (const ch of s) {
    if (ch === "W") out.push("wait");
    else if (ch === "U") out.push("up");
    else if (ch === "D") out.push("down");
    else if (ch === "L") out.push("left");
    else if (ch === "R") out.push("right");
  }
  return out;
}

function sim(actions: Action[]) {
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
  return { r, letters };
}

const prefix = parse("UURUUUULLLLLRRRRRDDDDDDDLLLLLLLUUU");
const door = parse("DDDRRURUURRRRUUUULLLLLLLUU");
const browns = parse("URRLLUUURR");
const exitMoves = parse("LLUULLL");

for (let kw = 3; kw <= 5; kw++) {
  for (let ew = 1; ew <= 4; ew++) {
    const actions = [
      ...prefix,
      ...Array<Action>(kw).fill("wait"),
      ...door,
      ...browns,
      ...Array<Action>(ew).fill("wait"),
      ...exitMoves,
    ];
    const { r, letters } = sim(actions);
    if (!r.completed) {
      if (kw === 4 && ew <= 3) {
        console.log("fail", { kw, ew, death: r.deathMessage, pos: `${r.gx},${r.gy}` });
      }
      continue;
    }
    const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
    console.log({
      kw,
      ew,
      rem,
      ticks: r.buttonPressCtx.moveBoundary,
      chips: letters.filter((c) => c !== "W").length,
      waits: letters.filter((c) => c === "W").length,
    });
    if (rem === 85) {
      writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
      console.log("EXACT BOLD", letters.join(""));
      process.exit(0);
    }
  }
}

// Try BFS door path with 3 key waits
const doorAlt = parse("DDDRRURUURRRRUUUULLLLLLLUU");
for (const doorPath of [door, doorAlt, parse("DDDRRRRRRRUUUUUUULLLLLLLU")]) {
  for (let kw = 3; kw <= 4; kw++) {
    for (let ew = 2; ew <= 3; ew++) {
      const actions = [
        ...prefix,
        ...Array<Action>(kw).fill("wait"),
        ...doorPath,
        ...browns,
        ...Array<Action>(ew).fill("wait"),
        ...exitMoves,
      ];
      const { r, letters } = sim(actions);
      if (r.completed) {
        const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
        if (rem >= 84) {
          console.log("alt", toLetters(doorPath), { kw, ew, rem, ticks: r.buttonPressCtx.moveBoundary });
        }
        if (rem === 85) {
          writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
          console.log("EXACT", letters.join(""));
          process.exit(0);
        }
      }
    }
  }
}

function toLetters(seq: Action[]) {
  return seq.map((a) => (a === "wait" ? "W" : LETTER[a])).join("");
}
