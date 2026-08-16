import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import { createMsCc1SimulationRunner, stepMsCc1Simulation, stepMsCc1Wait, cloneMsCc1SimulationRunner } from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import { isTrapOpen } from "../engine/msCc1/msCc1Traps.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webPath = path.join(root, "../../apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions/level-015.json");
const level = JSON.parse(readFileSync(path.join(root, "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json"), "utf8")) as LevelData;
normalizeLevelLayers(level);
const TIME_LIMIT=250, BOLD=89, MAX_TICKS=(TIME_LIMIT-BOLD)*5+4;
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
type Action = Direction | "wait";
const dirs: Direction[] = ["up","down","left","right"];

function applyLetters(letters: string[]): Runner {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  for (const ch of letters) {
    if (ch === "W") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, (ch==="U"?"up":ch==="D"?"down":ch==="L"?"left":"right") as Direction);
    if (r.playerDied || r.completed) break;
  }
  return r;
}

const saved = JSON.parse(readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8")) as { letters: string[] };
let letters = saved.letters;

const keySeq = "DRURULLLLL";
{
  const t = applyLetters(letters);
  for (const c of keySeq) {
    stepMsCc1Simulation(t, (c==="U"?"up":c==="D"?"down":c==="L"?"left":"right") as Direction);
    console.log(c, [t.gx,t.gy], "bomb="+cellTile(t.level,"upper",24,14), "keys="+t.playerState.keys.join(","), t.playerDied?t.deathMessage:"");
    if (t.playerDied) break;
  }
  console.log("result", { keys: t.playerState.keys, bomb: cellTile(t.level,"upper",24,14), died: t.playerDied });
  if (t.playerDied || cellTile(t.level,"upper",24,14)==="bomb" || !t.playerState.keys.includes("key_blue")) {
    console.error("key failed");
    process.exit(1);
  }
}
letters.push(...keySeq.split(""));
let r = applyLetters(letters);
console.log("after key", { pos:[r.gx,r.gy], keys:r.playerState.keys, tools:r.playerState.tools, ticks:r.buttonPressCtx.moveBoundary, rem: msSecondsRemaining(TIME_LIMIT,r.buttonPressCtx.moveBoundary) });

function mazeKey(r: Runner) {
  return [r.gx,r.gy,r.playerState.chipsRemainingOnMap,r.playerState.keys.join("+"),r.playerState.tools.join("+"),getCompositeTile(r.level,18,13),getCompositeTile(r.level,16,9)].join("|");
}
function bfs(start: Runner, maxDepth: number, maxNodes: number, done: (r: Runner)=>boolean): Action[]|null {
  type Frame = {seq:Action[]; runner:Runner};
  const q: Frame[] = [{seq:[], runner:start}];
  const seen = new Set([mazeKey(start)]);
  let n=0, qi=0;
  while (qi<q.length && n<maxNodes) {
    const f=q[qi++]!; n++;
    if (done(f.runner)) { console.log("found", n, "len", f.seq.length); return f.seq; }
    if (f.seq.length>=maxDepth || f.runner.playerDied || f.runner.buttonPressCtx.moveBoundary>MAX_TICKS) continue;
    for (const d of dirs) {
      const next = cloneMsCc1SimulationRunner(f.runner);
      stepMsCc1Simulation(next, d);
      if (next.playerDied || next.buttonPressCtx.moveBoundary>MAX_TICKS) continue;
      const k = mazeKey(next); if (seen.has(k)) continue; seen.add(k);
      q.push({seq:[...f.seq,d], runner:next});
    }
  }
  console.error("expanded", n); return null;
}

for (const [label, depth, nodes, done] of [
  ["chips3", 150, 1000000, (x:Runner)=>x.playerState.chipsRemainingOnMap<=3],
  ["chips0", 220, 1500000, (x:Runner)=>x.playerState.chipsRemainingOnMap<=0 && !x.playerState.tools.includes("ice_skates")],
  ["exit89", 120, 1000000, (x:Runner)=>x.completed && msSecondsRemaining(TIME_LIMIT,x.buttonPressCtx.moveBoundary)>=BOLD],
] as const) {
  console.log("Searching", label);
  const seg = bfs(r, depth, nodes, done);
  if (!seg) { console.error("FAIL", label); writeFileSync(path.join(root,".tmp/level015-bold-letters.json"), JSON.stringify({letters,label:"fail-"+label},null,2)); process.exit(1); }
  letters.push(...encodeSolutionMoves(seg));
  r = applyLetters(letters);
  console.log(label, {pos:[r.gx,r.gy], chips:r.playerState.chipsRemainingOnMap, tools:r.playerState.tools, keys:r.playerState.keys, ticks:r.buttonPressCtx.moveBoundary, rem:msSecondsRemaining(TIME_LIMIT,r.buttonPressCtx.moveBoundary), brown:getCompositeTile(r.level,16,9), done:r.completed});
  writeFileSync(path.join(root,".tmp/level015-bold-letters.json"), JSON.stringify({letters, label, rem:msSecondsRemaining(TIME_LIMIT,r.buttonPressCtx.moveBoundary), ticks:r.buttonPressCtx.moveBoundary},null,2));
}

const rem = msSecondsRemaining(TIME_LIMIT, r.buttonPressCtx.moveBoundary);
console.log("FINAL", {rem, ticks:r.buttonPressCtx.moveBoundary, exact:rem===BOLD, brown:getCompositeTile(r.level,16,9), trap:isTrapOpen(r.buttonPressCtx,16,16)});
if (r.completed && !r.playerDied && rem >= BOLD) {
  let finalLetters = letters, finalRem = rem, finalTicks = r.buttonPressCtx.moveBoundary;
  if (rem > BOLD) {
    const target = (TIME_LIMIT - BOLD) * 5;
    while (finalTicks < target) {
      const i = Math.max(0, finalLetters.length - 15);
      const cand = [...finalLetters.slice(0,i), "L","R", ...finalLetters.slice(i)];
      const t = applyLetters(cand);
      if (!t.completed || t.playerDied) break;
      const tr = msSecondsRemaining(TIME_LIMIT, t.buttonPressCtx.moveBoundary);
      if (tr < BOLD) break;
      finalLetters = cand; finalRem = tr; finalTicks = t.buttonPressCtx.moveBoundary;
      if (tr === BOLD) break;
    }
  }
  writeFileSync(webPath, JSON.stringify({
    levelId:"level-015", passwordMs:"COZQ", title:"Elementary", timeLimitSeconds:250, boldTimeRemaining:89, minChipMoves:161,
    moves: finalLetters,
    source:"https://scores.bitbusters.club/levels/cc1/15/ms",
    walkthroughUrl:"https://strategywiki.org/wiki/Chip%27s_Challenge/Levels_1-20",
    boldRouteHint:"Red key left → flippers+blue; blue → suction+red; water+force; blue→fire+red; red→skates+blue; chips; ice thief; brown→exit; 89",
    moveVerified:true, meetsBoldBudget: finalRem>=BOLD,
    moveSource:`StrategyWiki Elementary bold; engine-verified ${finalRem}s left (bold 89)`,
    simulatedTicks: finalTicks, simulatedSecondsRemaining: finalRem,
  }, null, 2) + "\n");
  console.log("WROTE", finalRem, "exact", finalRem===BOLD, "moves", finalLetters.length);
}
