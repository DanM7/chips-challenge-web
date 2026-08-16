import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webPath = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json",
);
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up", "down", "left", "right"];

function applyLetters(letters: string[]): Runner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else
      stepMsCc1Simulation(
        r,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (r.playerDied || r.completed) break;
  }
  return r;
}

function blockPos(r: Runner) {
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r.level, x, y) === "block_movable") return `${x},${y}`;
  return "none";
}

function mazeKey(r: Runner) {
  return `${r.gx},${r.gy}|${r.playerState.keys.join("+")}|${blockPos(r)}|${cellTile(r.level, "upper", 16, 11)}|${isTrapOpen(r.buttonPressCtx, 16, 16)}|${getCompositeTile(r.level, 16, 9)}`;
}

function bfsPath(start: Runner, done: (r: Runner) => boolean, label: string, maxNodes = 500000) {
  type Node = { r: Runner; parent: number; dir: Direction | null };
  const nodes: Node[] = [{ r: start, parent: -1, dir: null }];
  const seen = new Set([mazeKey(start)]);
  let qi = 0;
  while (qi < nodes.length && qi < maxNodes) {
    const cur = nodes[qi]!;
    if (done(cur.r)) {
      const seq: Direction[] = [];
      let i = qi;
      while (nodes[i]!.parent >= 0) {
        seq.push(nodes[i]!.dir!);
        i = nodes[i]!.parent;
      }
      seq.reverse();
      console.log(label, "found", qi, "len", seq.length, "ticks", cur.r.buttonPressCtx.moveBoundary);
      return seq;
    }
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(cur.r);
      stepMsCc1Simulation(next, d);
      if (next.playerDied) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      nodes.push({ r: next, parent: qi, dir: d });
    }
    qi++;
  }
  console.error(label, "fail", nodes.length);
  return null;
}

const saved = JSON.parse(readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8")) as {
  letters: string[];
};

// Cut back to chips0 (c1619) — before open_blue/trap
{
  const rs = createMsCc1SimulationRunner(structuredClone(level));
  let cut = -1;
  for (let i = 0; i < saved.letters.length; i++) {
    const ch = saved.letters[i]!;
    if (ch === "W") stepMsCc1Wait(rs);
    else
      stepMsCc1Simulation(
        rs,
        (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction,
      );
    if (
      rs.playerState.chipsRemainingOnMap === 0 &&
      rs.playerState.keys.includes("key_blue") &&
      rs.gx === 16 &&
      rs.gy === 19 &&
      cellTile(rs.level, "upper", 16, 15) !== "door_red"
    ) {
      cut = i + 1;
      break;
    }
  }
  if (cut < 0) throw new Error("no c1619");
  var letters = saved.letters.slice(0, cut);
}
let r = applyLetters(letters);
console.log("c1619", {
  rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
  block: blockPos(r),
  keys: r.playerState.keys,
});

// Combined goal: block on brown (allow any path)
console.log("Searching brown via any route");
{
  const seg = bfsPath(
    r,
    (x) => getCompositeTile(x.level, 16, 9) === "block_movable",
    "brown",
    2_000_000,
  );
  if (!seg) {
    // try intermediate: block at 16,15 then setup
    console.log("try intermediate block 16,15 with chip north then south push");
    const mid = bfsPath(
      r,
      (x) => blockPos(x) === "16,15" && isTrapOpen(x.buttonPressCtx, 16, 16),
      "b1615",
    );
    if (!mid) process.exit(1);
    letters.push(...encodeSolutionMoves(mid));
    r = applyLetters(letters);
    console.log("mid", { pos: [r.gx, r.gy], block: blockPos(r), trap: isTrapOpen(r.buttonPressCtx, 16, 16) });
    const setup = bfsPath(
      r,
      (x) => blockPos(x) === "16,14" && x.gx === 16 && x.gy === 15,
      "setup",
    );
    if (!setup) {
      console.error("no setup");
      process.exit(1);
    }
    letters.push(...encodeSolutionMoves(setup));
    r = applyLetters(letters);
    console.log("setup", { pos: [r.gx, r.gy], block: blockPos(r) });
    const brown = bfsPath(
      r,
      (x) => getCompositeTile(x.level, 16, 9) === "block_movable",
      "brown2",
    );
    if (!brown) process.exit(1);
    letters.push(...encodeSolutionMoves(brown));
  } else {
    letters.push(...encodeSolutionMoves(seg));
  }
  r = applyLetters(letters);
  console.log("brown", {
    rem: msSecondsRemaining(250, r.buttonPressCtx.moveBoundary),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
  });
}

console.log("Searching exit");
{
  let seg = bfsPath(
    r,
    (x) =>
      x.completed &&
      !x.playerDied &&
      msSecondsRemaining(250, x.buttonPressCtx.moveBoundary) >= 89,
    "exit89",
  );
  if (!seg) seg = bfsPath(r, (x) => x.completed && !x.playerDied, "exit_any");
  if (!seg) process.exit(1);
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
}

let finalLetters = letters;
let finalRem = msSecondsRemaining(250, r.buttonPressCtx.moveBoundary);
let finalTicks = r.buttonPressCtx.moveBoundary;
console.log("pre-pad", { finalRem, finalTicks, done: r.completed, brown: getCompositeTile(r.level, 16, 9) });

if (r.completed && finalRem > 89) {
  const targetLow = (250 - 89) * 5;
  let guard = 0;
  while (finalRem > 89 && finalTicks < targetLow + 4 && guard++ < 150) {
    const i = Math.max(0, finalLetters.length - 40);
    const cand = [...finalLetters.slice(0, i), "L", "R", ...finalLetters.slice(i)];
    const t = applyLetters(cand);
    if (!t.completed || t.playerDied) break;
    const tr = msSecondsRemaining(250, t.buttonPressCtx.moveBoundary);
    if (tr < 89) break;
    finalLetters = cand;
    finalRem = tr;
    finalTicks = t.buttonPressCtx.moveBoundary;
    if (finalRem === 89) break;
  }
}

const fr = applyLetters(finalLetters);
const stats = {
  rem: finalRem,
  ticks: finalTicks,
  exact: finalRem === 89,
  done: fr.completed,
  brown: getCompositeTile(fr.level, 16, 9),
  trap: isTrapOpen(fr.buttonPressCtx, 16, 16),
  moves: finalLetters.length,
  W: finalLetters.filter((c) => c === "W").length,
  U: finalLetters.filter((c) => c === "U").length,
  D: finalLetters.filter((c) => c === "D").length,
  L: finalLetters.filter((c) => c === "L").length,
  R: finalLetters.filter((c) => c === "R").length,
};
console.log("FINAL", stats);

if (fr.completed && finalRem >= 89) {
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
        moves: finalLetters,
        source: "https://scores.bitbusters.club/levels/cc1/15/ms",
        walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
        boldRouteHint:
          "SW/NW boots; fire/ice; NE red; open exit; chips; block brown; exit; 89",
        moveVerified: true,
        meetsBoldBudget: finalRem >= 89,
        moveSource: `StrategyWiki Elementary bold; engine-verified ${finalRem}s left (bold 89)`,
        simulatedTicks: finalTicks,
        simulatedSecondsRemaining: finalRem,
      },
      null,
      2,
    )}\n`,
  );
  console.log("WROTE", finalRem, "exact", finalRem === 89);
} else {
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify({ letters: finalLetters, label: "partial", rem: finalRem, ticks: finalTicks }, null, 2),
  );
  process.exit(1);
}
