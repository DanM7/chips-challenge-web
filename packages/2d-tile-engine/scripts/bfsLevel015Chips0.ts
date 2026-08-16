import { readFileSync, writeFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  cloneMsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const saved = JSON.parse(readFileSync(".tmp/level015-bold-letters.json", "utf8")) as {
  letters: string[];
};

function apply(letters: string[]) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
  }
  return r;
}

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];

function blocks(r: Runner) {
  let s = "";
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") s += `${x},${y};`;
  return s;
}

function chipsLeft(r: Runner) {
  const out: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const u = cellTile(r.level, "upper", x, y);
      if (u === "chip" || u === "computer_chip") out.push(`${x},${y}`);
    }
  return out;
}

function mazeKey(r: Runner) {
  return `${r.gx},${r.gy}|${r.playerState.chipsRemainingOnMap}|${r.playerState.keys.join("+")}|${r.playerState.tools.join("+")}|${blocks(r)}|${chipsLeft(r).join(";")}`;
}

const start = apply(saved.letters);
console.log("start", {
  pos: [start.gx, start.gy],
  chips: start.playerState.chipsRemainingOnMap,
  chipTiles: chipsLeft(start),
  keys: start.playerState.keys,
  blocks: blocks(start),
});

type Frame = { seq: Direction[]; runner: Runner };
const q: Frame[] = [{ seq: [], runner: start }];
const seen = new Set([mazeKey(start)]);
let n = 0;
let qi = 0;
let best = 2;
let found: Frame | null = null;
const t0 = Date.now();
while (qi < q.length && n < 2_000_000) {
  const f = q[qi++]!;
  n++;
  if (f.runner.playerState.chipsRemainingOnMap < best) {
    best = f.runner.playerState.chipsRemainingOnMap;
    console.log("best", best, "at", [f.runner.gx, f.runner.gy], "n", n, "len", f.seq.length, "keys", f.runner.playerState.keys, "chips", chipsLeft(f.runner), "ms", Date.now() - t0);
  }
  if (f.runner.playerState.chipsRemainingOnMap === 0 && f.runner.playerState.keys.includes("key_blue") && f.runner.playerState.keys.includes("key_red")) {
    found = f;
    console.log("FOUND chips0 with keys", n, f.seq.length, f.runner.buttonPressCtx.moveBoundary);
    break;
  }
  if (f.seq.length >= 160 || f.runner.playerDied || f.runner.buttonPressCtx.moveBoundary > 950) continue;
  for (const d of dirs) {
    const next = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(next, d);
    if (next.playerDied || next.buttonPressCtx.moveBoundary > 950) continue;
    const k = mazeKey(next);
    if (seen.has(k)) continue;
    seen.add(k);
    q.push({ seq: [...f.seq, d], runner: next });
  }
}
console.log("done n", n, "seen", seen.size, "found", !!found, "ms", Date.now() - t0);

if (found) {
  const letters = [...saved.letters, ...encodeSolutionMoves(found.seq)];
  const r = apply(letters);
  writeFileSync(
    ".tmp/level015-bold-letters.json",
    JSON.stringify(
      {
        letters,
        label: "chips0-keys",
        rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
        ticks: r.buttonPressCtx.moveBoundary,
      },
      null,
      2,
    ),
  );
  console.log("saved", {
    pos: [r.gx, r.gy],
    rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
    keys: r.playerState.keys,
    tools: r.playerState.tools,
    blocks: blocks(r),
  });
}
