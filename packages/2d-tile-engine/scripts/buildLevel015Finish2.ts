import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import { createMsCc1SimulationRunner, stepMsCc1Simulation, stepMsCc1Wait, cloneMsCc1SimulationRunner } from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves, decodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(readFileSync(path.join(root, "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json"), "utf8")) as LevelData;
normalizeLevelLayers(level);
const TIME_LIMIT = 250; const BOLD = 89; const MAX_TICKS = (TIME_LIMIT - BOLD) * 5 + 4;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";
const dirs: Direction[] = ["up","down","left","right"];
const saved = JSON.parse(readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8")) as { letters: string[] };

function applyLetters(letters: string[]): Runner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, (ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right") as Direction);
  }
  return r;
}

const fireSeq = "UUURRRRRRDRDLLLLL";
let letters = [...saved.letters, ...fireSeq];
let r = applyLetters(letters);
console.log("after fire+key", { pos:[r.gx,r.gy], tools:r.playerState.tools, keys:r.playerState.keys, bomb:cellTile(r.level,"upper",24,12), died:r.playerDied, ticks:r.buttonPressCtx.moveBoundary });
if (r.playerDied || !r.playerState.keys.includes("key_red")) { console.error("fail fire key"); process.exit(1); }

function mazeKey(r: Runner): string {
  return [r.gx,r.gy,r.playerState.chipsRemainingOnMap,r.playerState.keys.join("+"),r.playerState.tools.join("+"),cellTile(r.level,"upper",24,14),getCompositeTile(r.level,26,15),getCompositeTile(r.level,18,13),getCompositeTile(r.level,16,9)].join("|");
}
function bfs(start: Runner, maxDepth: number, maxNodes: number, done: (r: Runner)=>boolean, allowWait=false): Action[]|null {
  type Frame = {seq:Action[]; runner:Runner};
  const q: Frame[] = [{seq:[], runner:start}];
  const seen = new Set([mazeKey(start)]);
  let n=0, qi=0;
  while (qi<q.length && n<maxNodes) {
    const f = q[qi++]!; n++;
    if (done(f.runner)) { console.log("found", n, "len", f.seq.length); return f.seq; }
    if (f.seq.length>=maxDepth || f.runner.playerDied || f.runner.buttonPressCtx.moveBoundary>MAX_TICKS) continue;
    for (const a of (allowWait ? [...dirs, "wait" as const] : dirs)) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      if (a==="wait") stepMsCc1Wait(next); else stepMsCc1Simulation(next, a);
      if (next.playerDied || next.buttonPressCtx.moveBoundary>MAX_TICKS) continue;
      const k = mazeKey(next); if (seen.has(k)) continue; seen.add(k);
      q.push({seq:[...f.seq,a], runner:next});
    }
  }
  console.error("expanded", n); return null;
}

const goals = [
  {label:"ice_skates", depth:80, nodes:500000, done:(x:Runner)=>x.playerState.tools.includes("ice_skates") && cellTile(x.level,"upper",24,14)!=="bomb"},
  {label:"chips3", depth:150, nodes:800000, done:(x:Runner)=>x.playerState.chipsRemainingOnMap<=3},
  {label:"chips0_no_skates", depth:200, nodes:1200000, done:(x:Runner)=>x.playerState.chipsRemainingOnMap<=0 && !x.playerState.tools.includes("ice_skates")},
  {label:"exit89", depth:100, nodes:800000, wait:true, done:(x:Runner)=>x.completed && msSecondsRemaining(TIME_LIMIT, x.buttonPressCtx.moveBoundary)>=BOLD},
];
for (const g of goals) {
  console.log("Searching", g.label);
  const seg = bfs(r, g.depth, g.nodes, g.done, !!(g as any).wait);
  if (!seg) { console.error("FAIL", g.label); writeFileSync(path.join(root,".tmp/level015-bold-letters.json"), JSON.stringify({letters, label:"fail-"+g.label},null,2)); process.exit(1); }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  console.log(g.label, {pos:[r.gx,r.gy], chips:r.playerState.chipsRemainingOnMap, tools:r.playerState.tools, keys:r.playerState.keys, ticks:r.buttonPressCtx.moveBoundary, rem:msSecondsRemaining(TIME_LIMIT,r.buttonPressCtx.moveBoundary), done:r.completed});
  writeFileSync(path.join(root,".tmp/level015-bold-letters.json"), JSON.stringify({letters, label:g.label, rem:msSecondsRemaining(TIME_LIMIT,r.buttonPressCtx.moveBoundary), ticks:r.buttonPressCtx.moveBoundary},null,2));
}
console.log("FINAL", {rem:msSecondsRemaining(TIME_LIMIT,r.buttonPressCtx.moveBoundary), exact:msSecondsRemaining(TIME_LIMIT,r.buttonPressCtx.moveBoundary)===BOLD, moves:letters.length});
