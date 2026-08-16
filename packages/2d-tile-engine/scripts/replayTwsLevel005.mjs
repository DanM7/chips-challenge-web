/**
 * Replay TWS with MS timing: uppercase = chip step, lowercase/comma/dot = idle wait.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";

const MS_DIR: Record<string, "up" | "down" | "left" | "right"> = {
  L: "left",
  R: "right",
  U: "up",
  D: "down",
};

function replayTwsMs(tws: string) {
  const level = JSON.parse(
    fs.readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
      ),
      "utf8",
    ),
  );
  normalizeLevelLayers(level);
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  const chipMoves: string[] = [];
  let i = 0;
  while (i < tws.length) {
    while (i < tws.length && (tws[i] === " " || tws[i] === "," || tws[i] === ".")) {
      stepMsCc1Wait(runner);
      i++;
      if (runner.completed || runner.playerDied) break;
    }
    if (i >= tws.length || runner.completed || runner.playerDied) break;

    const numMatch = /^\d+/.exec(tws.slice(i));
    let count = 1;
    if (numMatch) {
      count = Number.parseInt(numMatch[0], 10);
      i += numMatch[0].length;
      while (i < tws.length && (tws[i] === " " || tws[i] === "," || tws[i] === ".")) {
        stepMsCc1Wait(runner);
        i++;
        if (runner.completed || runner.playerDied) break;
      }
      if (i >= tws.length || runner.completed || runner.playerDied) break;
    }

    const ch = tws[i]!;
    const upper = MS_DIR[ch];
    if (upper) {
      for (let n = 0; n < count; n++) {
        stepMsCc1Wait(runner);
        if (runner.playerDied || runner.completed) break;
        stepMsCc1Simulation(runner, upper);
        chipMoves.push(upper);
        if (runner.playerDied || runner.completed) break;
      }
      i++;
      if (tws[i] === "3" && tws[i + 1] === ",") i += 2;
      continue;
    }
    if (ch === "l" || ch === "r" || ch === "u" || ch === "d") {
      stepMsCc1Wait(runner);
      i++;
      continue;
    }
    i++;
  }
  return { runner, chipMoves };
}

const tws = JSON.parse(
  fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../integration/data/cc1-ms-solutions.json"),
    "utf8",
  ),
).levels["5"].twsMoves;

const { runner, chipMoves } = replayTwsMs(tws);
console.log("tws", tws);
console.log("chipMoves", chipMoves);
console.log("completed", runner.completed, "died", runner.playerDied, "pos", runner.gx, runner.gy);
