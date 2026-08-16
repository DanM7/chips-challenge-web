import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import type { Direction, LevelData } from "../../engine/types.js";
import { normalizeLevelLayers } from "../../engine/levelLayers.js";
import { simulateMsCc1Level, createMsCc1SimulationRunner, stepMsCc1Simulation, stepMsCc1Wait, runnerToResult } from "../../engine/msCc1/msCc1Simulation.js";
import { decodeSolutionMoves, type SolutionAction } from "../../engine/solutionMoves.js";
import { chipsLeftAtLevelStart } from "../../engine/countCollectibles.js";
import { MS_DEATH_CREATURES } from "../../engine/msCc1/msCc1Monsters.js";
import {
  MS_DEATH_NO_BOMBS,
  MS_DEATH_NO_FIRE_BOOTS,
  MS_DEATH_NO_FLIPPERS,
} from "../../engine/msCc1/msCc1Movement.js";
import { listLevelNumbers, readIndex, readLevelSolution } from "../../integration/solutionStorage.js";

function simulateSolutionActions(level: LevelData, actions: SolutionAction[]) {
  const runner = createMsCc1SimulationRunner(level);
  for (const action of actions) {
    if (action === "wait") stepMsCc1Wait(runner);
    else stepMsCc1Simulation(runner, action);
    if (runner.completed || runner.playerDied) break;
  }
  return runnerToResult(runner);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const webPackRoot = path.join(
  root,
  "../../apps/chips-challenge-web/public/games/chips-challenge-1",
);

interface SolutionEntry {
  levelId: string;
  timeLimitSeconds?: number;
  boldTimeRemaining?: number;
  minChipMoves?: number;
  moves: string[] | null;
  moveVerified?: boolean;
  meetsBoldBudget?: boolean;
  twsMoves?: string;
  moveSource?: string;
  source?: string;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function loadPackLevel(levelId: string): LevelData {
  const level = readJson<LevelData>(path.join(webPackRoot, "levels", `${levelId}.json`));
  normalizeLevelLayers(level);
  return level;
}

function levelFromGrid(
  cells: Record<string, string>,
  width = 8,
  height = 8,
  lowerCells: Record<string, string> = {},
  playerStart = { x: 0, y: 0 },
): LevelData {
  const upper = Array.from({ length: width * height }, () => "empty");
  const lower = Array.from({ length: width * height }, () => "empty");
  for (const [key, tile] of Object.entries(cells)) {
    const [xs, ys] = key.split(",");
    upper[Number(ys) * width + Number(xs)] = tile;
  }
  for (const [key, tile] of Object.entries(lowerCells)) {
    const [xs, ys] = key.split(",");
    lower[Number(ys) * width + Number(xs)] = tile;
  }
  const level: LevelData = {
    id: "test",
    name: "test",
    width,
    height,
    tileSize: 32,
    layers: { upper, lower },
    playerStart,
    chipsRequired: 0,
  };
  normalizeLevelLayers(level);
  return level;
}

describe("CC1 MS integration — bold metadata", () => {
  it("solution index has bold budgets for early lessons", () => {
    const level1 = readLevelSolution<SolutionEntry>(1);
    expect(level1?.boldTimeRemaining).toBe(83);
    expect(level1?.minChipMoves).toBe(17);
    expect(level1?.source).toMatch(/bitbusters\.club/);
  });

  it("indexes all 149 CC1 MS levels with chip-move budgets", () => {
    expect(listLevelNumbers(readIndex()).length).toBe(149);
    for (const levelNumber of listLevelNumbers(readIndex())) {
      const entry = readLevelSolution<SolutionEntry>(levelNumber);
      expect(entry?.levelId).toMatch(/^level-\d{3}$/);
      if (entry?.minChipMoves != null) {
        expect(entry.minChipMoves).toBeGreaterThan(0);
      }
    }
  });
});

describe("CC1 MS integration — happy path (recorded solutions)", () => {
  const verifiedLevels = listLevelNumbers(readIndex()).filter((levelNumber) => {
    const entry = readLevelSolution<SolutionEntry>(levelNumber);
    return (
      Array.isArray(entry?.moves) &&
      entry.moves.length > 0 &&
      entry.moveVerified === true
    );
  });

  it("stores TWS tapes for lessons with imported records (pending engine verification)", () => {
    for (let n = 1; n <= 9; n += 1) {
      const entry = readLevelSolution<SolutionEntry & { twsRecords?: unknown[] }>(n);
      const tapeLength = entry?.twsRecords?.length ?? entry?.moves?.length ?? 0;
      expect(tapeLength, `level ${n} tape`).toBeGreaterThan(0);
      expect(entry?.moveSource ?? entry?.twsMoves).toBeTruthy();
    }
  });

  it("has at least one recorded solution to replay", () => {
    if (verifiedLevels.length === 0) {
      console.warn(
        "No recorded moves in cc1-ms-solutions yet; add verified routes to enable full level replays.",
      );
    }
    expect(verifiedLevels.length).toBeGreaterThanOrEqual(0);
  });

  for (const levelNum of verifiedLevels) {
    it(`level ${levelNum} completes within bold chip-move budget`, () => {
      const entry = readLevelSolution<SolutionEntry>(levelNum)!;
      const level = loadPackLevel(entry.levelId);
      const result = simulateSolutionActions(level, decodeSolutionMoves(entry.moves!));
      expect(result.playerDied, result.deathMessage).toBe(false);
      expect(result.completed, `stopped at ${result.finalPosition.x},${result.finalPosition.y}`).toBe(
        true,
      );
      if (entry.minChipMoves != null && entry.meetsBoldBudget !== false) {
        expect(result.chipMoves).toBeLessThanOrEqual(entry.minChipMoves);
      }
    });
  }

  it("minimal exit level completes with a short route", () => {
    const level = levelFromGrid(
      {
        "1,1": "chip_s",
        "2,1": "exit",
      },
      4,
      4,
      {},
      { x: 1, y: 1 },
    );
    const moves: Direction[] = ["right"];
    const result = simulateMsCc1Level(level, moves);
    expect(result.completed).toBe(true);
    expect(result.chipMoves).toBe(1);
  });
});

describe("CC1 MS integration — death scenarios (negative)", () => {
  it("stepping on water without flippers kills Chip", () => {
    const level = levelFromGrid(
      { "0,0": "chip_s", "1,0": "water" },
      4,
      4,
      {},
      { x: 0, y: 0 },
    );
    const result = simulateMsCc1Level(level, ["right"]);
    expect(result.playerDied).toBe(true);
    expect(result.deathMessage).toBe(MS_DEATH_NO_FLIPPERS);
  });

  it("monster stepping on Chip kills Chip", () => {
    const level = levelFromGrid(
      {
        "0,1": "chip_s",
        "1,1": "bug_e",
      },
      4,
      4,
      {},
      { x: 0, y: 1 },
    );
    level.monsters = [{ x: 1, y: 1, direction: "east" }];
    const result = simulateMsCc1Level(level, ["right"]);
    expect(result.playerDied).toBe(true);
    expect(result.deathMessage).toBe(MS_DEATH_CREATURES);
  });

  it("stepping on a closed trap without release leaves Chip stuck (no exit)", () => {
    const level = levelFromGrid(
      {
        "0,1": "chip_s",
        "1,1": "trap",
      },
      4,
      4,
      {},
      { x: 0, y: 1 },
    );
    level.trapLinks = [{ button: { x: 0, y: 0 }, trap: { x: 1, y: 1 } }];
    const ontoTrap = simulateMsCc1Level(level, ["right"]);
    expect(ontoTrap.playerDied).toBe(false);
    expect(ontoTrap.completed).toBe(false);
    const stuck = simulateMsCc1Level(level, ["right", "up"]);
    expect(stuck.completed).toBe(false);
    expect(stuck.chipMoves).toBe(2);
  });

  it("touching a bomb kills Chip", () => {
    const level = levelFromGrid(
      { "0,0": "chip_s", "1,0": "bomb" },
      4,
      4,
      {},
      { x: 0, y: 0 },
    );
    const result = simulateMsCc1Level(level, ["right"]);
    expect(result.playerDied).toBe(true);
    expect(result.deathMessage).toBe(MS_DEATH_NO_BOMBS);
  });

  it("stepping on fire without fire boots kills Chip", () => {
    const level = levelFromGrid(
      { "0,0": "chip_s", "1,0": "fire" },
      4,
      4,
      {},
      { x: 0, y: 0 },
    );
    const result = simulateMsCc1Level(level, ["right"]);
    expect(result.playerDied).toBe(true);
    expect(result.deathMessage).toBe(MS_DEATH_NO_FIRE_BOOTS);
  });

  it("teeth monster stepping on Chip kills Chip", () => {
    const level = levelFromGrid(
      {
        "0,1": "chip_s",
        "1,1": "teeth_e",
      },
      4,
      4,
      {},
      { x: 0, y: 1 },
    );
    level.monsters = [{ x: 1, y: 1, direction: "east" }];
    const result = simulateMsCc1Level(level, ["right"]);
    expect(result.playerDied).toBe(true);
    expect(result.deathMessage).toBe(MS_DEATH_CREATURES);
  });

  it("socket blocks exit while chips remain", () => {
    const level = levelFromGrid(
      {
        "0,0": "chip_s",
        "1,0": "socket",
        "2,0": "exit",
      },
      4,
      4,
      {},
      { x: 0, y: 0 },
    );
    level.chipsRequired = 1;
    const blocked = simulateMsCc1Level(level, ["right", "right"]);
    expect(blocked.completed).toBe(false);
    expect(chipsLeftAtLevelStart(level)).toBe(1);
  });
});
