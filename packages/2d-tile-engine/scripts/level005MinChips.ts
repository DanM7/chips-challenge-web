import { readFileSync, writeFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  msCc1RunnerStateKey,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";

type Action = Direction | "wait";
const DIRS: Direction[] = ["up", "down", "left", "right"];
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

type Runner = MsCc1SimulationRunner;

function apply(start: Runner, seq: Action[]): Runner {
  const r = cloneMsCc1SimulationRunner(start);
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
  return r;
}

/** BFS that minimizes chip moves (waits allowed but cost 0 for move count; soft-cost for queue). */
function bfsMinChipMoves(
  start: Runner,
  maxChipMoves: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  maxWaits = 12,
): Action[] | null {
  const q: { seq: Action[]; runner: Runner; chips: number; waits: number }[] = [
    { seq: [], runner: start, chips: 0, waits: 0 },
  ];
  const seen = new Map<string, number>(); // state -> best chip moves
  seen.set(msCc1RunnerStateKey(start), 0);
  let n = 0;
  while (q.length && n < maxNodes) {
    // sort-ish: process lower chip counts first (bucket)
    q.sort((a, b) => a.chips - b.chips || a.waits - b.waits);
    const f = q.shift()!;
    n += 1;
    if (done(f.runner)) return f.seq;
    if (f.chips >= maxChipMoves || f.runner.playerDied) continue;

    for (const d of DIRS) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before) continue;
      const chips = f.chips + 1;
      const prev = seen.get(after);
      if (prev !== undefined && prev <= chips) continue;
      seen.set(after, chips);
      q.push({ seq: [...f.seq, d], runner: next, chips, waits: f.waits });
    }
    if (f.waits < maxWaits) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      const before = msCc1RunnerStateKey(next);
      stepMsCc1Wait(next);
      if (next.playerDied) continue;
      const after = msCc1RunnerStateKey(next);
      if (after === before) continue;
      // Don't let waits alone beat a chip-move path to same state with fewer chips
      const prev = seen.get(after);
      if (prev !== undefined && prev < f.chips) continue;
      if (prev === f.chips) continue; // same chips, skip wait duplicate
      seen.set(after, f.chips);
      q.push({
        seq: [...f.seq, "wait"],
        runner: next,
        chips: f.chips,
        waits: f.waits + 1,
      });
    }
  }
  console.error("exhausted", n);
  return null;
}

const toLetters = (seq: Action[]) =>
  seq.map((a) => (a === "wait" ? "W" : LETTER[a]));

let r = createMsCc1SimulationRunner(structuredClone(level));
const full: Action[] = [];

const goals: { label: string; maxChips: number; nodes: number; done: (r: Runner) => boolean }[] = [
  {
    label: "toggle open",
    maxChips: 14,
    nodes: 100_000,
    done: (x) => x.gx === 16 && x.gy === 13, // on green; first visit opens
  },
  {
    label: "red key",
    maxChips: 30,
    nodes: 500_000,
    done: (x) => x.playerState.keys.some((k) => k.includes("red")),
  },
  {
    label: "through door",
    maxChips: 30,
    nodes: 500_000,
    done: (x) => x.gy <= 11,
  },
  {
    label: "both traps",
    maxChips: 20,
    nodes: 400_000,
    done: (x) =>
      isTrapOpen(x.buttonPressCtx, 18, 7) && isTrapOpen(x.buttonPressCtx, 18, 10),
  },
  {
    label: "win",
    maxChips: 25,
    nodes: 600_000,
    done: (x) => x.completed,
  },
];

for (const g of goals) {
  if (g.done(r)) {
    console.log("skip", g.label);
    continue;
  }
  console.log("seek", g.label, "from", r.gx, r.gy, "chips so far", full.filter((a) => a !== "wait").length);
  const seg = bfsMinChipMoves(r, g.maxChips, g.nodes, g.done);
  if (!seg) {
    console.error("FAIL", g.label);
    process.exit(1);
  }
  const chips = seg.filter((a) => a !== "wait").length;
  const waits = seg.filter((a) => a === "wait").length;
  console.log("  ok chips", chips, "waits", waits, toLetters(seg).join(""));
  full.push(...seg);
  r = apply(r, seg);
  console.log(
    "  ->",
    r.gx,
    r.gy,
    "totalChips",
    full.filter((a) => a !== "wait").length,
    "rem",
    msSecondsRemaining(100, r.buttonPressCtx.moveBoundary),
  );
}

const letters = toLetters(full);
const rem = msSecondsRemaining(100, r.buttonPressCtx.moveBoundary);
console.log({
  completed: r.completed,
  rem,
  boldExact: rem === 85,
  chips: letters.filter((c) => c !== "W").length,
  waits: letters.filter((c) => c === "W").length,
  ticks: r.buttonPressCtx.moveBoundary,
});
writeFileSync("scripts/level005-letters.json", JSON.stringify(letters) + "\n");
