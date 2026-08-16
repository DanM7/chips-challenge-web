import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it } from "vitest";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { parseCcMoveString, parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadLevel001(): LevelData {
  const level = JSON.parse(
    fs.readFileSync(
      path.join(
        root,
        "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
      ),
      "utf8",
    ),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

const goldenTws =
  "2L,,l,,l,,L3,2Rr,,Rr,,2Rr,,R,,RLl,,Ll,,L3,Dd,d,,D,D,2Ll,L,LDd,,D3U5R2DR3,Rr,,2R,u,,2U,Dd,,D5L,d,,D3L4Rr,,R,Ll,,L,,Dd,,Dd,,Dd,,d";

const readmeTws =
  "5L3R3,r,,4Rr,,R2Ll,,2L5D5L3D3U5R2D5R3U3D5L,Dd,,R,r,,R,l,,5L3R6D,,d";

function replayWithLog(level: LevelData, moves: Direction[], label: string): void {
  const runner = createMsCc1SimulationRunner(structuredClone(level));
  console.log(`\n=== ${label} (${moves.length} moves) ===`);
  console.log("start", runner.gx, runner.gy, "chips", runner.playerState.chipsRemainingOnMap);

  for (let i = 0; i < moves.length; i += 1) {
    const before = { x: runner.gx, y: runner.gy, chips: runner.playerState.chipsRemainingOnMap };
    const dir = moves[i]!;
    const ended = stepMsCc1Simulation(runner, dir);
    const tile = getCompositeTile(runner.level, runner.gx, runner.gy);
    const moved = before.x !== runner.gx || before.y !== runner.gy;
    const chipDelta = before.chips - runner.playerState.chipsRemainingOnMap;
    const keys = runner.playerState.keys.join("+") || "-";

    if (
      ended ||
      i < 12 ||
      i >= moves.length - 5 ||
      (runner.gx === 13 && runner.gy === 16) ||
      !moved
    ) {
      console.log(
        `#${i + 1} ${dir}`,
        moved ? `${before.x},${before.y}->${runner.gx},${runner.gy}` : "BLOCKED",
        `chips ${runner.playerState.chipsRemainingOnMap}`,
        chipDelta ? `(-${chipDelta})` : "",
        `keys=${keys}`,
        tile,
        ended ? `END died=${runner.playerDied} win=${runner.completed}` : "",
      );
    }

    if (runner.completed || runner.playerDied) {
      break;
    }
  }

  console.log(
    "final",
    runner.gx,
    runner.gy,
    "chips",
    runner.playerState.chipsRemainingOnMap,
    "completed",
    runner.completed,
    runner.deathMessage ?? "",
  );
}

describe("level 001 TWS debug", () => {
  it("logs golden vs stored vs readme TWS replays", () => {
    const level = loadLevel001();
    const solutionsPath = path.join(root, "integration/data/cc1-ms-solutions.json");
    const doc = JSON.parse(fs.readFileSync(solutionsPath, "utf8")) as {
      levels: { "1": { twsMoves?: string; moves: Direction[] } };
    };

    replayWithLog(level, parseCcMoveString(goldenTws), "golden TWS (legacy parser)");
    replayWithLog(level, parseCcMoveStringMs(goldenTws), "golden TWS (MS uppercase only)");

    if (doc.levels["1"].twsMoves) {
      console.log("\nstored twsMoves matches golden:", doc.levels["1"].twsMoves === goldenTws);
    }
  });

  it("logs wiki opening then step-by-step", () => {
    const level = loadLevel001();
    const runner = createMsCc1SimulationRunner(structuredClone(level));
    const opening: Direction[] = ["left", "left", "up", "up", "left"];
    for (const d of opening) {
      stepMsCc1Simulation(runner, d);
    }
    console.log("\n=== after wiki 2L2UL ===");
    console.log("pos", runner.gx, runner.gy, "chips", runner.playerState.chipsRemainingOnMap);
    console.log("keys", runner.playerState.keys);
    console.log("tile", getCompositeTile(runner.level, runner.gx, runner.gy));

    for (const d of ["left", "right", "up", "down"] as Direction[]) {
      const probe = cloneMsCc1SimulationRunner(runner);
      const b = { x: probe.gx, y: probe.gy, chips: probe.playerState.chipsRemainingOnMap };
      stepMsCc1Simulation(probe, d);
      console.log(
        `try ${d}:`,
        `${b.x},${b.y}->${probe.gx},${probe.gy}`,
        "chips",
        probe.playerState.chipsRemainingOnMap,
        getCompositeTile(probe.level, probe.gx, probe.gy),
      );
    }
  });
});
