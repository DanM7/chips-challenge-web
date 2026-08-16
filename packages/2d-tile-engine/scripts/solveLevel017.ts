/**
 * Level 17 Nice Day — seed-search StrategyWiki / TWS routes with deterministic RNG.
 */
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webPack = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1",
);
const webSol = path.join(webPack, "data/cc1-ms-solutions/level-017.json");
const engSol = path.join(root, "integration/data/cc1-ms-solutions/level-017.json");
const autoplayRngPath = path.join(
  root,
  "../../apps/chips-challenge-web/src/data/autoplayRng.ts",
);

/** Mirror of apps/.../autoplayRng.ts deterministicAutoplayChoice */
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

function loadLevel(): LevelData {
  const level = JSON.parse(
    readFileSync(path.join(webPack, "levels/level-017.json"), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

type Action = Direction | "wait";

function expandRoute(route: string): Action[] {
  const out: Action[] = [];
  const re = /(\d+)?([UDLRW])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(route.replace(/\s/g, ""))) !== null) {
    const count = m[1] ? Number.parseInt(m[1], 10) : 1;
    const ch = m[2]!.toUpperCase();
    const map: Record<string, Action> = {
      U: "up",
      D: "down",
      L: "left",
      R: "right",
      W: "wait",
    };
    for (let i = 0; i < count; i += 1) out.push(map[ch]!);
  }
  return out;
}

function patchRng(seed: number): () => void {
  const orig = Math.random;
  let step = 0;
  Math.random = () => {
    // Stream in [0,1) from autoplayRng mix; seed offsets the stream.
    const v = deterministicAutoplayChoice(seed, step++, 0x10000000);
    return v / 0x10000000;
  };
  return () => {
    Math.random = orig;
  };
}

function runActions(
  level: LevelData,
  actions: Action[],
  opts: { idleBetweenChipMoves?: boolean } = {},
): {
  completed: boolean;
  died: boolean;
  death?: string;
  rem: number | null;
  ticks: number;
  chips: number;
  pos: string;
  chipMoves: number;
  actionsUsed: Action[];
} {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  let chipIndex = 0;
  for (const action of actions) {
    if (action === "wait") {
      stepMsCc1Wait(runner);
    } else {
      if (opts.idleBetweenChipMoves && chipIndex > 0) {
        stepMsCc1Wait(runner);
        if (runner.playerDied) break;
      }
      stepMsCc1Simulation(runner, action);
      chipIndex += 1;
    }
    if (runner.completed || runner.playerDied) break;
  }
  const ticks = runner.buttonPressCtx.moveBoundary;
  return {
    completed: runner.completed,
    died: runner.playerDied,
    death: runner.deathMessage,
    rem: msSecondsRemaining(100, ticks),
    ticks,
    chips: runner.playerState.chipsRemainingOnMap,
    pos: `${runner.gx},${runner.gy}`,
    chipMoves: runner.chipMoves,
    actionsUsed: actions.slice(
      0,
      // approximate: return full if completed
      actions.length,
    ),
  };
}

function twsToActions(
  records: { tick: number; direction: number }[],
): Action[] {
  const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
  const actions: Action[] = [];
  let prev = 0;
  for (const rec of records) {
    const gap = Math.max(0, rec.tick - prev - 1);
    for (let i = 0; i < gap; i += 1) actions.push("wait");
    actions.push("wait"); // TWS replay always waits one tick then moves
    const dir = TWS_DIR[rec.direction];
    if (dir) actions.push(dir);
    prev = rec.tick;
  }
  return actions;
}

/** StrategyWiki bold skeleton — eyes then smile R→L then SW exit. */
function strategyWikiRoutes(): { name: string; actions: Action[] }[] {
  // Start (15,14). 5L → (10,14). Left eye at (10-11,8-10): 4U to (10,10), then collect.
  // Eye pickup SW: 2U R 2D from below eye — from (10,14): need to approach.
  // Classic: 5L 2U R 2D gets left eye pair pattern starting mid.
  // From (15,14): 5L → (10,14); 2U → (10,12); but chips are at y=8-10.
  // Re-read SW: "Play 5L, collect the first eye 2U R 2D" — so after 5L you're under the eye
  // and 2U R 2D collects a 2-wide column? Chips at (10,10)(11,10)(10,9)(11,9)(10,8)(11,8).
  // From (10,14): need more ups. Perhaps path is 5L 4U into chips then pattern.
  // BitBusters/TWS starts with UUUU then LLLLL — different approach (north first).
  // Try several known skeletons:

  const routes: { name: string; route: string }[] = [
    // SW literal (may be incomplete east count)
    {
      name: "sw-literal-5L-eye-east",
      // 5L, left eye 2UR2D, 9R to right eye area, same eye, 5L7D into smile, west smile, SW exit
      route:
        "5L 2U R 2D 4U 2L 2U 2R 2D 2R 2U 2L" + // improvise left eye collect
        "",
    },
  ];
  void routes;

  // Hand-built from map geometry:
  // Left eye chips: (10-11, 8-10). Right: (20-21, 8-10).
  // From (15,14): LLLLL to (10,14), UUUU to (10,10) pick, U to (10,9), U (10,8),
  // R (11,8), D (11,9), D (11,10) — that's left eye (6 chips). Equivalent to arriving + snake.
  // SW "2U R 2D" is the snake on the 2x3 once you're at the bottom of the eye.

  const leftEye = "5L 4U R U L U R D L D"; // collect left 2x3 ending (10,10)? Let's simulate pieces.
  // Cleaner left eye: 5L 4U (on 10,10 chip) U (10,9) U (10,8) R (11,8) D (11,9) D (11,10)
  const leftEyeClean = "5L4UUURDD"; // wait that's only 5 chips path...
  // 5L 4U: first chip at (10,10). Then U U R D D collects remaining 5. Total path through 6 cells.
  // Sequence standing on first chip after 5L4U: need UURDD but miss (11,10) if we end at (11,10) via... 
  // Path: (10,10)->(10,9)->(10,8)->(11,8)->(11,9)->(11,10): moves UURDD. Yes 5L4U + UURDD = 5L4UUURDD
  // That's 5L + 4U + UURDD = 5L 5U R D D — SW said 2U R 2D which is shorter subset once positioned.

  const rightEyeFromLeft =
    // From (11,10) after left eye: go to (20,10): 9R, then collect right eye similarly.
    // Right eye (20-21,8-10): from (11,10) 9R → (20,10), then UURDD → end (21,10)
    "9RUURDD";

  // After right eye at (21,10): SW says 5L 7D depending on walkers into smile.
  // Smile chips: arc from (26,17) down to (15,23) then left to (5,17).
  // From (21,10): 5L → (16,10), 7D → (16,17). Or go toward right smile tip (26,17).
  // Collect smile R→L: start at right tip.

  const toSmileRight =
    // From (21,10): RRRRR DDDDDDD → (26,17) tip. Or 5R 7D.
    "5R7D";

  // Smile path R→L (approximate snake along chip arc):
  // chips: 26,17; 25-26,18; 24-25,19; 23-24,20; 21-23,21; 19-21,22; 12-19,23; then left side mirror
  const smile =
    // at (26,17): D L D L D L D LL D LLL D LLLL  then continue left side ascending
    "D L D L D L D 2L D 3L D 4L" + // along bottom to ~ (12,23) area — verify later
    " L L L L L L L" + // through bottom row chips
    "";

  void leftEye;
  void leftEyeClean;
  void rightEyeFromLeft;
  void toSmileRight;
  void smile;

  // Full curated route string — refined by simulation feedback below
  const curated: { name: string; route: string }[] = [
    {
      name: "eyes-smile-sw",
      route:
        // left eye
        "5L4UUURDD" +
        // to right eye + collect
        "9RUURDD" +
        // to right smile tip
        "5R7D" +
        // smile west along arc (manual)
        "DLDLDLD2LD3LD4L7L" +
        // left smile up-ish then to SW exit (1,30) via toggles
        // from ~ (5,23)? Need to compute — use alternate full path below
        "",
    },
  ];

  // Build a precise smile path by walking chip coordinates in order (R to L).
  const smileOrder: [number, number][] = [
    [26, 17],
    [26, 18],
    [25, 18],
    [25, 19],
    [24, 19],
    [24, 20],
    [23, 20],
    [23, 21],
    [22, 21],
    [21, 21],
    [21, 22],
    [20, 22],
    [19, 22],
    [19, 23],
    [18, 23],
    [17, 23],
    [16, 23],
    [15, 23],
    [14, 23],
    [13, 23],
    [12, 23],
    [12, 22],
    [11, 22],
    [10, 22],
    [10, 21],
    [9, 21],
    [8, 21],
    [8, 20],
    [7, 20],
    [7, 19],
    [6, 19],
    [6, 18],
    [5, 18],
    [5, 17],
  ];

  function pathBetween(ax: number, ay: number, bx: number, by: number): string {
    let s = "";
    let x = ax;
    let y = ay;
    while (x < bx) {
      s += "R";
      x += 1;
    }
    while (x > bx) {
      s += "L";
      x -= 1;
    }
    while (y < by) {
      s += "D";
      y += 1;
    }
    while (y > by) {
      s += "U";
      y -= 1;
    }
    return s;
  }

  function movesAlong(points: [number, number][], start: [number, number]): string {
    let s = "";
    let [x, y] = start;
    for (const [px, py] of points) {
      s += pathBetween(x, y, px, py);
      x = px;
      y = py;
    }
    return s;
  }

  // After right eye end at (21,10) via 5L4UUURDD9RUURDD
  const afterRightEye: [number, number] = [21, 10];
  const toFirstSmile = movesAlong([smileOrder[0]!], afterRightEye);
  const alongSmile = movesAlong(smileOrder.slice(1), smileOrder[0]!);
  // From last smile (5,17) to SW exit (1,30): need through toggles — path left/down
  // Exit at (1,30), sockets around. Approach: from (5,17) go toward (1,30)
  // Likely: LLLL then down through open toggles, or DDD... then L.
  // Toggle wall band is diagonal. SW exit is lower left behind sockets.
  // From (5,17): path to (3,30) then through socket corridor to exit (1,30).
  // Sockets at corners — need all chips first (46). After smile we have all.
  // Path: try LL D13 L2 D to exit area — will search variants.

  const exitVariants = [
    "4L13D2L2D2L", // rough
    "3L14D3L1D1L",
    "2L7D2L7D3L1D1L",
    "4L7D2L7D2L1D1L",
    "5L6D2L8D2L1D1L",
    "3D3L10D3L1D1L",
    "2D4L11D3L1D1L",
    "4L5D1L3D1L6D2L1D1L",
    "4L12D1L1D2L1D1L",
    "4L13D1L1D1L1D1L",
    // wait for toggles
    "4L5W13D2L2D2L",
    "4L10W13D2L2D2L",
    "4L20W13D2L2D2L",
    "4L13D5W2L2D2L",
    "2L10W2L13D2L2D2L",
  ];

  const base =
    "5L4UUURDD" + // left eye → (11,10)
    "9RUURDD" + // right eye → (21,10)
    toFirstSmile +
    alongSmile;

  const out: { name: string; actions: Action[] }[] = [];
  for (const [i, ex] of exitVariants.entries()) {
    out.push({ name: `sw-base-exit-${i}`, actions: expandRoute(base + ex) });
  }

  // Also try going to smile via 5L7D from right eye as SW says
  const sw57 =
    "5L4UUURDD9RUURDD5L7D" +
    movesAlong(smileOrder, [16, 17]) + // may not be on smile yet
    "";
  void curated;
  void sw57;

  // From (21,10) SW 5L7D → (16,17). Nearest smile chip from there?
  // Smile at y=23 mostly; (16,23) is on bottom. From (16,17): 6D to (16,23).
  const fromSw57 =
    "5L4UUURDD9RUURDD5L7D6D" +
    movesAlong(
      [
        [16, 23],
        ...smileOrder.filter(([x, y]) => y === 23 && x < 16).reverse(), // go right first? SW says smile west so go right to end then west
      ],
      [16, 23],
    );

  // Better: from (16,17) go to right tip then west
  const swThenRightThenWest =
    "5L4UUURDD9RUURDD5L7D" +
    movesAlong(smileOrder, [16, 17]);

  for (const [i, ex] of exitVariants.entries()) {
    out.push({
      name: `sw-5L7D-exit-${i}`,
      actions: expandRoute(swThenRightThenWest + ex),
    });
  }

  // Left eye first via SW 5L2UR2D then more to finish eye
  // 5L2UR2D from (15,14): (10,14)->(10,12)->(11,12)->(11,14) — doesn't hit chips!
  // So SW assumes different positioning or abbreviated. Stick with geometric route.

  void fromSw57;
  return out;
}

function search(): void {
  const level = loadLevel();
  const existing = JSON.parse(readFileSync(engSol, "utf8")) as {
    twsRecords: { tick: number; direction: number }[];
    passwordMs: string;
    title: string;
    boldTimeRemaining: number;
    timeLimitSeconds: number;
  };

  const candidates = [
    { name: "tws", actions: twsToActions(existing.twsRecords) },
    ...strategyWikiRoutes(),
  ];

  let best: {
    name: string;
    seed: number;
    rem: number;
    ticks: number;
    actions: Action[];
    idleBetween: boolean;
  } | null = null;

  const seeds = Array.from({ length: 500 }, (_, i) => 17 + i);
  // also try pure level-17 stream and small seeds
  for (let s = 0; s < 200; s += 1) seeds.push(s);
  seeds.push(17, 83, 100, 1337, 42, 1, 0);

  for (const cand of candidates) {
    for (const idleBetween of [false, true]) {
      for (const seed of seeds) {
        const restore = patchRng(seed);
        try {
          const r = runActions(level, cand.actions, {
            idleBetweenChipMoves: idleBetween,
          });
          if (!r.completed) continue;
          const rem = r.rem ?? -1;
          if (!best || rem > best.rem) {
            best = {
              name: cand.name,
              seed,
              rem,
              ticks: r.ticks,
              actions: cand.actions,
              idleBetween,
            };
            console.log(
              "NEW BEST",
              best.name,
              "seed",
              seed,
              "rem",
              rem,
              "idle",
              idleBetween,
              "chipsLeft0",
            );
          }
          if (rem >= 83) {
            console.log("HIT BOLD", best);
            restore();
            writeBest(best);
            return;
          }
        } finally {
          restore();
        }
      }
    }
  }

  if (best) {
    console.log("Best effort:", best.name, best.seed, best.rem, best.idleBetween);
    writeBest(best);
  } else {
    console.log("No completing route found in search grid");
    // Diagnose first route under seed 17
    const restore = patchRng(17);
    try {
      const r = runActions(level, candidates[1]?.actions ?? candidates[0]!.actions);
      console.log("diagnose", r);
    } finally {
      restore();
    }
  }
}

function writeBest(best: {
  name: string;
  seed: number;
  rem: number;
  ticks: number;
  actions: Action[];
  idleBetween: boolean;
}): void {
  const letters = encodeSolutionMoves(
    best.actions.filter((a, i, arr) => {
      // If idleBetween mode, we need to inject W between chip moves into stored route
      return true;
    }),
  );

  // If simulation used idle-between, encode W between consecutive chip moves
  let moves: string[];
  if (best.idleBetween) {
    const out: string[] = [];
    let seenChip = false;
    for (const a of best.actions) {
      if (a === "wait") {
        out.push("W");
      } else {
        if (seenChip) out.push("W");
        const letter =
          a === "up" ? "U" : a === "down" ? "D" : a === "left" ? "L" : "R";
        out.push(letter);
        seenChip = true;
      }
    }
    moves = out;
  } else {
    moves = encodeSolutionMoves(best.actions);
  }

  // Re-verify with simulateSolution style (no auto idle — W explicit)
  const level = loadLevel();
  const restore = patchRng(best.seed);
  let verified;
  try {
    verified = runActions(
      level,
      moves.map((l) =>
        l === "W"
          ? "wait"
          : l === "U"
            ? "up"
            : l === "D"
              ? "down"
              : l === "L"
                ? "left"
                : "right",
      ),
    );
  } finally {
    restore();
  }

  const meets = (verified.rem ?? -1) >= 83;
  const entry = {
    levelId: "level-017",
    passwordMs: "AJMG",
    title: "Nice Day",
    timeLimitSeconds: 100,
    boldTimeRemaining: 83,
    minChipMoves: 17,
    moves,
    source: "https://scores.bitbusters.club/levels/cc1/17/ms",
    walkthroughUrl: "https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint:
      "5L left eye, east right eye, smile R→L, SW exit; walkers/toggles RNG",
    moveVerified: verified.completed === true,
    meetsBoldBudget: meets,
    moveSource: `StrategyWiki Nice Day best-effort; autoplayRng stream seed=${best.seed} route=${best.name}; rem=${verified.rem} (bold 83)${meets ? "" : "; toggles/walkers blocked bold"}`,
    simulatedTicks: verified.ticks,
    simulatedSecondsRemaining: verified.rem,
    rngSeed: best.seed,
    rngPolicy: "deterministicAutoplayChoice(seed, step, 2^28)/2^28 as Math.random",
  };

  writeFileSync(webSol, JSON.stringify(entry, null, 2) + "\n");
  writeFileSync(engSol, JSON.stringify(entry, null, 2) + "\n");
  console.log("Wrote", webSol, "moves", moves.length, "rem", verified.rem, "ok", verified.completed);
  void autoplayRngPath;
  void letters;
  void copyFileSync;
}

search();
