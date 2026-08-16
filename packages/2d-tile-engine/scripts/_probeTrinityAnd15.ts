/** Scripted Trinity west/red-key after override; dump 15 chips0 exit. */
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
import { readLevelSolution } from "../integration/solutionStorage.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";

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
    for (let i = 0; i < n; i++) {
      out.push(ch === "W" ? "wait" : ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right");
    }
  }
  return out;
}

function apply(r: ReturnType<typeof createMsCc1SimulationRunner>, seq: (Direction | "wait")[]) {
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) return;
  }
}

function dumpAround(r: ReturnType<typeof createMsCc1SimulationRunner>, cx: number, cy: number, rad = 6) {
  for (let y = cy - rad; y <= cy + rad; y++) {
    let row = "";
    for (let x = cx - rad; x <= cx + rad; x++) {
      if (x === r.gx && y === r.gy) {
        row += "@";
        continue;
      }
      const t = getCompositeTile(r.level, x, y);
      const f = getForceFloorTileAt(r.level, x, y);
      const mon = r.monsters.find((m) => m.alive && m.x === x && m.y === y);
      if (mon) row += "M";
      else if (t === "wall") row += "#";
      else if (t.includes("key_red")) row += "R";
      else if (t.includes("key_yellow")) row += "Y";
      else if (t.includes("key_blue")) row += "B";
      else if (t === "fire") row += "f";
      else if (t === "water") row += "~";
      else if (t === "ice") row += "i";
      else if (f === "force_s") row += "v";
      else if (f === "force_n") row += "^";
      else if (f === "force_e") row += ">";
      else if (f === "force_w") row += "<";
      else if (t && t !== "empty") row += "?";
      else row += ".";
    }
    console.log(String(y).padStart(2), row);
  }
}

{
  console.log("\n=== TRINITY west ===");
  const level = load(11);
  const r = createMsCc1SimulationRunner(structuredClone(level));
  apply(r, expand("D3LD"));
  apply(r, ["up"]);
  console.log("open+U", `${r.gx},${r.gy}`, getForceFloorTileAt(r.level, r.gx, r.gy));
  dumpAround(r, 6, 14, 8);

  const trials = [
    "L",
    "R",
    "D",
    "U",
    "DL",
    "DR",
    "DLU",
    "D2L",
    "2D3L",
    "D4L",
    "2D5L",
    "D2L2D5L",
    "2D LLLLL UUUUUU",
    "DLDLDLDL",
    "RDLULDL",
    "D L D L D 5L U",
  ];
  for (const t of trials) {
    const n = cloneMsCc1SimulationRunner(r);
    apply(n, expand(t.replace(/\s+/g, "")));
    console.log(
      "try",
      t,
      `${n.gx},${n.gy}`,
      "keys",
      n.playerState.keys.join("+") || "-",
      n.playerDied ? n.deathMessage : "",
    );
  }

  // BFS from open+U with waits, goal red key, include monster in key
  const dirs: Direction[] = ["up", "down", "left", "right"];
  type N = { r: typeof r; seq: string };
  const q: N[] = [{ r: cloneMsCc1SimulationRunner(r), seq: "" }];
  const seen = new Set([`${r.gx},${r.gy}|${r.monsters.map((m) => `${m.x},${m.y}`).join(";")}`]);
  let nodes = 0;
  let found: string | null = null;
  while (q.length && nodes < 200_000) {
    const f = q.shift()!;
    nodes++;
    if (f.r.playerState.keys.includes("key_red")) {
      found = f.seq;
      console.log("RED KEY", f.seq, `${f.r.gx},${f.r.gy}`, "nodes", nodes);
      break;
    }
    if (f.seq.length >= 80) continue;
    for (const extra of ["", "W"] as const) {
      for (const d of dirs) {
        const n = cloneMsCc1SimulationRunner(f.r);
        if (extra === "W") stepMsCc1Wait(n);
        if (n.playerDied) continue;
        stepMsCc1Simulation(n, d);
        if (n.playerDied) continue;
        const k = `${n.gx},${n.gy}|${n.playerState.keys.join("+")}|${n.monsters.map((m) => `${m.x},${m.y},${m.direction}`).join(";")}`;
        if (seen.has(k)) continue;
        seen.add(k);
        q.push({ r: n, seq: f.seq + extra + d[0]!.toUpperCase() });
      }
    }
  }
  console.log({ nodes, seen: seen.size, found, q: q.length });
}

{
  console.log("\n=== ELEMENTARY chips0 / exit ===");
  const level = load(15);
  const tws = decodeSolutionMoves(readLevelSolution<{ moves: string[] }>(15)!.moves) as Direction[];
  const r = createMsCc1SimulationRunner(structuredClone(level));
  let chips0 = -1;
  for (let i = 0; i < tws.length; i++) {
    stepMsCc1Simulation(r, tws[i]!);
    if (r.playerDied) {
      console.log("tws died", i, r.deathMessage);
      break;
    }
    if (chips0 < 0 && r.playerState.chipsRemainingOnMap === 0) {
      chips0 = i;
      console.log("chips0 at", i, `${r.gx},${r.gy}`, "ticks", r.buttonPressCtx.moveBoundary, "rem", msSecondsRemaining(250, r.buttonPressCtx.moveBoundary), "keys", r.playerState.keys, "redDoor", cellTile(r.level, "upper", 16, 15), "trap", isTrapOpen(r.buttonPressCtx, 16, 16));
      let block = "gone";
      for (let y = 0; y < 32; y++)
        for (let x = 0; x < 32; x++)
          if (getCompositeTile(r.level, x, y) === "block_movable") block = `${x},${y}`;
      console.log("block", block, "brown16,9", getCompositeTile(r.level, 16, 9));
    }
    if (r.completed) {
      console.log("tws complete at", i, "rem", msSecondsRemaining(250, r.buttonPressCtx.moveBoundary));
      break;
    }
  }

  // from 793
  const r793 = createMsCc1SimulationRunner(structuredClone(level));
  for (const d of tws.slice(0, 793)) stepMsCc1Simulation(r793, d);
  console.log("at793", `${r793.gx},${r793.gy}`, "chips", r793.playerState.chipsRemainingOnMap, "ticks", r793.buttonPressCtx.moveBoundary, "keys", r793.playerState.keys, "trap", isTrapOpen(r793.buttonPressCtx, 16, 16), "red", cellTile(r793.level, "upper", 16, 15));
  let block = "gone";
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++)
      if (getCompositeTile(r793.level, x, y) === "block_movable") block = `${x},${y}`;
  console.log("block793", block);

  const dirs: Direction[] = ["up", "down", "left", "right"];
  type N = { r: typeof r793; seq: Direction[] };
  const q: N[] = [{ r: cloneMsCc1SimulationRunner(r793), seq: [] }];
  const seen = new Set([`${r793.gx},${r793.gy}|${isTrapOpen(r793.buttonPressCtx, 16, 16)}|${block}`]);
  let nodes = 0;
  const hits: { seq: string; rem: number; ticks: number }[] = [];
  while (q.length && nodes < 80_000) {
    const f = q.shift()!;
    nodes++;
    if (f.r.completed) {
      const rem = msSecondsRemaining(250, f.r.buttonPressCtx.moveBoundary);
      hits.push({ seq: encodeSolutionMoves(f.seq).join(""), rem, ticks: f.r.buttonPressCtx.moveBoundary });
      if (rem >= 89 && hits.length >= 5) break;
      continue;
    }
    if (f.seq.length >= 24) continue;
    for (const d of dirs) {
      const n = cloneMsCc1SimulationRunner(f.r);
      stepMsCc1Simulation(n, d);
      if (n.playerDied) continue;
      let b = "g";
      for (let y = 8; y <= 16; y++)
        for (let x = 14; x <= 20; x++)
          if (getCompositeTile(n.level, x, y) === "block_movable") b = `${x},${y}`;
      const k = `${n.gx},${n.gy}|${n.playerState.keys.join("+")}|${isTrapOpen(n.buttonPressCtx, 16, 16)}|${b}|${cellTile(n.level, "upper", 16, 15)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ r: n, seq: [...f.seq, d] });
    }
  }
  hits.sort((a, b) => b.rem - a.rem);
  console.log("exit bfs nodes", nodes, "hits", hits.slice(0, 8));
}
