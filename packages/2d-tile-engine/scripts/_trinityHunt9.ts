/** Trinity path around the y=23 wall; Hunt delete consecutive waste; dump 9 fireballs. */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function load(n: number): LevelData {
  const level = JSON.parse(
    readFileSync(
      path.join(
        root,
        `../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-${String(n).padStart(3, "0")}.json`,
      ),
      "utf8",
    ),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function expand(s: string): (Direction | "wait")[] {
  const out: (Direction | "wait")[] = [];
  const re = /(\d*)([UDLRW])/g;
  let m: RegExpExecArray | null;
  const t = s.replace(/\s+/g, "");
  while ((m = re.exec(t))) {
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    const ch = m[2]!;
    for (let i = 0; i < n; i++)
      out.push(ch === "W" ? "wait" : ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right");
  }
  return out;
}

{
  const level = load(11);
  const r0 = createMsCc1SimulationRunner(structuredClone(level));
  for (const a of expand("D3LD")) {
    if (a === "wait") stepMsCc1Wait(r0);
    else stepMsCc1Simulation(r0, a);
  }
  for (const [x, y] of [
    [9, 19],
    [9, 20],
    [9, 21],
    [8, 20],
    [8, 24],
    [9, 24],
    [10, 22],
    [11, 22],
    [11, 23],
    [11, 24],
  ] as const) {
    console.log(
      `11 ${x},${y}`,
      getCompositeTile(r0.level, x, y),
      cellTile(r0.level, "upper", x, y),
      "force",
      getForceFloorTileAt(r0.level, x, y),
    );
  }

  const paths = [
    "2L2D2R2D4L",
    "2L2D2R2D3L",
    "2L2D2R2D5L",
    "2L2D2R2D4L2U",
    "2L2D2R2D4LU",
    "2L2D2R2D4L4U",
    "2L2D2R2D4L10U",
    "2L2D2R2D4L2U2L10U",
    "2L2D2R2D2L2D4L",
    "2L2DRD2D4L",
  ];
  for (const p of paths) {
    const r = cloneMsCc1SimulationRunner(r0);
    for (const a of expand(p)) {
      if (a === "wait") stepMsCc1Wait(r);
      else stepMsCc1Simulation(r, a);
      if (r.playerDied) break;
    }
    console.log("path", p, `${r.gx},${r.gy}`, r.playerDied ? r.deathMessage : "", "keys", r.playerState.keys, "force", getForceFloorTileAt(r.level, r.gx, r.gy));
  }
}

{
  const level = load(12);
  const web = JSON.parse(
    readFileSync(
      path.join(
        root,
        "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-012.json",
      ),
      "utf8",
    ),
  );
  let moves = decodeSolutionMoves(web.moves) as Direction[];
  function verify(m: Direction[]) {
    const r = createMsCc1SimulationRunner(structuredClone(level));
    for (const d of m) {
      stepMsCc1Simulation(r, d);
      if (r.playerDied) return { ok: false, rem: 0, ticks: 0 };
      if (r.completed) break;
    }
    return { ok: r.completed, rem: msSecondsRemaining(400, r.buttonPressCtx.moveBoundary), ticks: r.buttonPressCtx.moveBoundary };
  }
  const wasteRuns = [
    [164, 166],
    [196, 199],
    [415, 417],
    [667, 672],
  ];
  for (const [a, b] of wasteRuns) {
    const trial = [...moves.slice(0, a), ...moves.slice(b)];
    const v = verify(trial);
    console.log("hunt drop", a, b, v);
    if (v.ok && v.rem > 266) {
      moves = trial;
    }
  }
}

{
  const level = load(9);
  const r = createMsCc1SimulationRunner(structuredClone(level));
  console.log(
    "9 start",
    `${r.gx},${r.gy}`,
    r.monsters.map((m) => `${m.kind}@${m.x},${m.y}:${m.direction}`),
  );
  for (let y = 0; y < 32; y++) {
    let row = "";
    let interesting = false;
    for (let x = 0; x < 32; x++) {
      const t = getCompositeTile(r.level, x, y);
      const f = getForceFloorTileAt(r.level, x, y);
      let ch = ".";
      if (x === r.gx && y === r.gy) ch = "@";
      else if (r.monsters.some((m) => m.x === x && m.y === y)) ch = "M";
      else if (t === "wall") ch = "#";
      else if (t === "chip") ch = "c";
      else if (t === "block_movable") ch = "B";
      else if (t === "bomb") ch = "o";
      else if (t === "water") ch = "~";
      else if (t === "fire") ch = "f";
      else if (t === "ice") ch = "i";
      else if (t?.includes("key")) ch = "K";
      else if (t?.includes("lock") || t?.includes("door")) ch = "D";
      else if (t === "exit") ch = "E";
      else if (t === "socket") ch = "S";
      else if (t === "button_green") ch = "g";
      else if (t === "button_brown") ch = "b";
      else if (f === "force_s") ch = "v";
      else if (f === "force_n") ch = "^";
      else if (f === "force_e") ch = ">";
      else if (f === "force_w") ch = "<";
      else if (t && t !== "empty") ch = "?";
      if (ch !== "." && ch !== "#") interesting = true;
      row += ch;
    }
    if (interesting) console.log(String(y).padStart(2), row);
  }
}
