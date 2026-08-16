import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const lines: string[] = [];
for (let y = 8; y <= 21; y++) {
  let row = String(y).padStart(2) + " ";
  for (let x = 7; x <= 23; x++) {
    const t = getCompositeTile(level, x, y);
    const sx = level.playerStart!.x;
    const sy = level.playerStart!.y;
    let c = ".";
    if (x === sx && y === sy) c = "@";
    else if (t === "wall") c = "#";
    else if (t === "chip") c = "*";
    else if (t === "exit") c = "E";
    else if (t === "socket") c = "S";
    else if (t === "key_yellow") c = "Y";
    else if (t === "key_blue") c = "B";
    else if (t === "key_red") c = "R";
    else if (t === "key_green") c = "G";
    else if (t === "door_yellow") c = "y";
    else if (t === "door_blue") c = "b";
    else if (t === "door_red") c = "r";
    else if (t === "door_green") c = "g";
    else if (t === "hint") c = "?";
    else if (t !== "empty" && !String(t).startsWith("chip_")) c = "?";
    row += c;
  }
  lines.push(row);
}

const tws = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-tws-records.json"), "utf8"),
) as {
  solutions: Array<{ number: number; moves: Array<{ dir: string }> }>;
};
const sol = tws.solutions.find((s) => s.number === 1)!;
const dirs = sol.moves.map((m) => m.dir as Direction);
lines.push("");
lines.push("TWS: " + dirs.map((d) => d[0]!.toUpperCase()).join(""));

const runner = createMsCc1SimulationRunner(structuredClone(level));
const log: string[] = [];
for (let i = 0; i < dirs.length; i++) {
  const d = dirs[i]!;
  const before = {
    x: runner.gx,
    y: runner.gy,
    chips: runner.playerState.chipsRemainingOnMap,
    keys: [...runner.playerState.keys],
  };
  const ended = stepMsCc1Simulation(runner, d);
  const moved = runner.gx !== before.x || runner.gy !== before.y;
  if (!moved || ended || i < 25 || i >= dirs.length - 20) {
    log.push(
      `${i} ${d[0]} (${before.x},${before.y}) c${before.chips} [${before.keys}] -> (${runner.gx},${runner.gy}) c${runner.playerState.chipsRemainingOnMap} [${runner.playerState.keys}] moved=${moved} done=${runner.completed} died=${runner.playerDied}`,
    );
  }
  if (ended) break;
}
log.push(
  `FINAL ticks=${runner.buttonPressCtx.moveBoundary} rem=${msSecondsRemaining(100, runner.buttonPressCtx.moveBoundary)} pos=${runner.gx},${runner.gy}`,
);

writeFileSync(path.join(root, ".tmp/level001-bold-debug.txt"), [...lines, "", ...log].join("\n"));
console.log(lines.join("\n"));
console.log(log.slice(0, 40).join("\n"));
console.log("...");
console.log(log.slice(-25).join("\n"));
