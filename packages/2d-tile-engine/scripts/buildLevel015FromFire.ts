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

const TIME_LIMIT = 250;
const BOLD = 89;
const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";
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

function status(label: string, r: Runner) {
  console.log(label, {
    pos: [r.gx, r.gy],
    chips: r.playerState.chipsRemainingOnMap,
    tools: [...r.playerState.tools],
    keys: [...r.playerState.keys],
    ticks: r.buttonPressCtx.moveBoundary,
    rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
    brown: getCompositeTile(r.level, 16, 9),
    trap: isTrapOpen(r.buttonPressCtx, 16, 16),
    died: r.playerDied,
    death: r.deathMessage,
    done: r.completed,
  });
}

function mazeKey(r: Runner): string {
  return [
    r.gx,
    r.gy,
    r.playerState.chipsRemainingOnMap,
    r.playerState.keys.join("+"),
    r.playerState.tools.join("+"),
    cellTile(r.level, "upper", 24, 14),
    getCompositeTile(r.level, 18, 13),
    getCompositeTile(r.level, 16, 9),
    getCompositeTile(r.level, 26, 15),
  ].join("|");
}

function bfs(
  start: Runner,
  maxDepth: number,
  maxNodes: number,
  done: (r: Runner) => boolean,
  allowWait = false,
): Action[] | null {
  type Frame = { seq: Action[]; runner: Runner };
  const q: Frame[] = [{ seq: [], runner: start }];
  const seen = new Set([mazeKey(start)]);
  let n = 0;
  let qi = 0;
  while (qi < q.length && n < maxNodes) {
    const f = q[qi++]!;
    n++;
    if (done(f.runner)) {
      console.log("  found", n, "len", f.seq.length);
      return f.seq;
    }
    if (
      f.seq.length >= maxDepth ||
      f.runner.playerDied ||
      f.runner.buttonPressCtx.moveBoundary > MAX_TICKS
    )
      continue;
    for (const a of allowWait ? [...dirs, "wait" as const] : dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      if (a === "wait") stepMsCc1Wait(next);
      else stepMsCc1Simulation(next, a);
      if (next.playerDied || next.buttonPressCtx.moveBoundary > MAX_TICKS) continue;
      const k = mazeKey(next);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, a], runner: next });
    }
  }
  console.error("  expanded", n);
  return null;
}

// Load letters from swcomplete progress - it wrote after fire via status but may not have saved.
// Re-read terminal output isn't letters. Re-run quick to fire using same openings from complete script's mid-state.
// The swcomplete process wrote to level015-bold-letters on fail ice - check
const saved = JSON.parse(
  readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8"),
) as { letters: string[]; label?: string };
console.log("saved", saved.label, saved.letters.length);
let letters = saved.letters;
let r = applyLetters(letters);
status("loaded", r);

// If not at fire+red, we need to rebuild - check tools
if (!r.playerState.tools.includes("fire_boots")) {
  console.error("need fire state - re-run swcomplete first section");
  process.exit(1);
}

// Try ice skates manuals from (22,12)
const iceTries = [
  // via row 10 to red door 20,15 to SE
  "UUULLLLLLDDDDDRRRRRRD",
  "UUULLLLLLDDDDDDRRRRRRD",
  "UUULLLLLLDDDDDRRRRRRDRDLLLLL",
  "UUULLLLLLDDDDDRRRRRRDRDLLLLLL",
  // mirror of fire approach for SE: red door at 20,15
  "UUULLLLLDDDDDRRRRRRD",
  "DDDDRRRRRRD", // if already can go down
  "ULLLLLDDDDDRRRRRRD",
  "L L L L L L D D D D D R R R R R R D".replace(/ /g, ""),
];

let iceSeq: string | null = null;
for (const s of iceTries) {
  const t = applyLetters([...letters, ...s.split("")]);
  const ok =
    !t.playerDied &&
    t.playerState.tools.includes("ice_skates") &&
    cellTile(t.level, "upper", 24, 14) !== "bomb" &&
    t.playerState.keys.includes("key_blue");
  console.log(ok ? "OK" : "  ", s.slice(0, 40), {
    pos: [t.gx, t.gy],
    tools: t.playerState.tools,
    keys: t.playerState.keys,
    bomb: cellTile(t.level, "upper", 24, 14),
    died: t.playerDied,
    death: t.deathMessage,
  });
  if (ok) {
    iceSeq = s;
    break;
  }
}

if (!iceSeq) {
  console.log("BFS ice...");
  const seg = bfs(
    r,
    120,
    1_000_000,
    (x) =>
      x.playerState.tools.includes("ice_skates") &&
      cellTile(x.level, "upper", 24, 14) !== "bomb",
  );
  if (!seg) {
    console.error("FAIL ice");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
} else {
  letters.push(...iceSeq.split(""));
}
r = applyLetters(letters);
status("ice", r);

for (const [label, depth, nodes, done] of [
  ["chips3", 150, 1_000_000, (x: Runner) => x.playerState.chipsRemainingOnMap <= 3],
  [
    "chips0_thief",
    220,
    1_500_000,
    (x: Runner) =>
      x.playerState.chipsRemainingOnMap <= 0 && !x.playerState.tools.includes("ice_skates"),
  ],
] as const) {
  console.log("Searching", label);
  const seg = bfs(r, depth, nodes, done);
  if (!seg) {
    console.error("FAIL", label);
    writeFileSync(
      path.join(root, ".tmp/level015-bold-letters.json"),
      JSON.stringify({ letters, label: "fail-" + label }, null, 2),
    );
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  status(label, r);
  writeFileSync(
    path.join(root, ".tmp/level015-bold-letters.json"),
    JSON.stringify(
      {
        letters,
        label,
        rem: msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary),
        ticks: r.buttonPressCtx.moveBoundary,
      },
      null,
      2,
    ),
  );
}

console.log("Searching exit89 with block on brown");
{
  const seg = bfs(
    r,
    120,
    1_000_000,
    (x) =>
      x.completed &&
      getCompositeTile(x.level, 16, 9) === "block_movable" &&
      msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
  );
  const fallback = !seg
    ? bfs(
        r,
        120,
        1_000_000,
        (x) =>
          x.completed &&
          msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary) >= BOLD,
      )
    : null;
  const use = seg ?? fallback;
  if (!use) {
    console.error("FAIL exit");
    process.exit(1);
  }
  letters.push(...encodeSolutionMoves(use));
  r = applyLetters(letters);
  status("exit", r);
}

const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
console.log("FINAL", {
  rem,
  ticks: r.buttonPressCtx.moveBoundary,
  exact: rem === BOLD,
  moves: letters.length,
  brown: getCompositeTile(r.level, 16, 9),
});

if (r.completed && !r.playerDied && rem >= BOLD) {
  let finalLetters = letters;
  let finalRem = rem;
  let finalTicks = r.buttonPressCtx.moveBoundary;
  if (rem > BOLD) {
    const target = (TIME_LIMIT - BOLD) * 5;
    while (finalTicks < target) {
      const insertAt = Math.max(0, finalLetters.length - 15);
      const cand = [
        ...finalLetters.slice(0, insertAt),
        "L",
        "R",
        ...finalLetters.slice(insertAt),
      ];
      const t = applyLetters(cand);
      if (!t.completed || t.playerDied) break;
      const tr = msSecondsRemaining(TIME_LIMIT, t.buttonPressCtx.moveBoundary);
      if (tr < BOLD) break;
      finalLetters = cand;
      finalRem = tr;
      finalTicks = t.buttonPressCtx.moveBoundary;
      console.log("burn", { rem: tr, ticks: finalTicks });
      if (tr === BOLD) break;
    }
  }
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
        moves: finalLetters,
        source: "https://scores.bitbusters.club/levels/cc1/15/ms",
        walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
        boldRouteHint:
          "Red key left → flippers+blue; blue → suction+red; water+force chips; blue→fire+red; red→skates+blue; fire/ice chips; ice thief slide; block on brown → exit; 89",
        moveVerified: true,
        meetsBoldBudget: finalRem >= BOLD,
        moveSource: `StrategyWiki Elementary bold; engine-verified ${finalRem}s left (bold 89)`,
        simulatedTicks: finalTicks,
        simulatedSecondsRemaining: finalRem,
      },
      null,
      2,
    )}\n`,
  );
  console.log("WROTE", webPath, finalRem, finalRem === BOLD);
}
