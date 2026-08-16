import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import { createMsCc1SimulationRunner, stepMsCc1Simulation, stepMsCc1Wait, cloneMsCc1SimulationRunner } from "../engine/msCc1/msCc1Simulation.js";
import { encodeSolutionMoves } from "../engine/solutionMoves.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(readFileSync(path.join(root, "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-015.json"), "utf8")) as LevelData;
normalizeLevelLayers(level);
type Runner = ReturnType<typeof createMsCc1SimulationRunner>;
const dirs: Direction[] = ["up","down","left","right"];
const saved = JSON.parse(readFileSync(path.join(root, ".tmp/level015-bold-letters.json"), "utf8")) as { letters: string[] };
const start = createMsCc1SimulationRunner(structuredClone(level));
for (const ch of saved.letters) {
  if (ch === "W") stepMsCc1Wait(start);
  else stepMsCc1Simulation(start, (ch==="U"?"up":ch==="D"?"down":ch==="L"?"left":"right") as Direction);
}

function mazeKey(r: Runner): string {
  let blocks = "";
  for (let y = 12; y <= 17; y++) for (let x = 20; x <= 28; x++)
    if (getCompositeTile(r.level, x, y) === "block_movable") blocks += `${x},${y};`;
  return `${r.gx},${r.gy}|${r.playerState.keys.join("+")}|${blocks}|${cellTile(r.level,"upper",24,14)}`;
}

type Frame = { seq: Direction[]; runner: Runner };
const q: Frame[] = [{ seq: [], runner: start }];
const seen = new Set([mazeKey(start)]);
let n = 0, qi = 0;
let found: Direction[] | null = null;
while (qi < q.length && n < 2_000_000) {
  const f = q[qi++]!; n++;
  if (f.runner.playerState.keys.includes("key_blue") && cellTile(f.runner.level,"upper",24,14) !== "bomb") {
    found = f.seq; break;
  }
  if (f.seq.length >= 60 || f.runner.playerDied) continue;
  for (const d of dirs) {
    const next = cloneMsCc1SimulationRunner(f.runner);
    stepMsCc1Simulation(next, d);
    if (next.playerDied) continue;
    const k = mazeKey(next);
    if (seen.has(k)) continue;
    seen.add(k);
    q.push({ seq: [...f.seq, d], runner: next });
  }
}
console.log(found ? ("OK " + encodeSolutionMoves(found).join("") + " len " + found.length + " nodes " + n) : ("FAIL nodes " + n + " seen " + seen.size));
