import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeLevelLayers } from "@engine/levelLayers";
import type { LevelData } from "@engine/types";
import {
  decodeSolutionMoves,
  encodeSolutionMoves,
} from "../src/data/solutionMoves";
import { simulateSolutionLetters } from "./helpers/simulateSolution";
import { deterministicAutoplayChoice } from "../src/data/autoplayRng";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pack = path.join(
  root,
  "apps/chips-challenge-web/public/games/chips-challenge-1",
);
const solutionsDir = path.join(pack, "data/cc1-ms-solutions");
const statusPath = path.join(solutionsDir, "status-1-20.json");

function loadLevel(n: number): LevelData {
  const id = String(n).padStart(3, "0");
  const level = JSON.parse(
    readFileSync(path.join(pack, "levels", `level-${id}.json`), "utf8"),
  ) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function loadSolution(n: number) {
  const id = String(n).padStart(3, "0");
  return JSON.parse(
    readFileSync(path.join(solutionsDir, `level-${id}.json`), "utf8"),
  ) as {
    moves: string[] | null;
    moveVerified?: boolean;
    meetsBoldBudget?: boolean;
    boldTimeRemaining: number;
    timeLimitSeconds: number;
    simulatedSecondsRemaining?: number;
    rngSeed?: number;
  };
}

describe("solutionMoves wait letter", () => {
  it("round-trips waits as W", () => {
    expect(encodeSolutionMoves(["up", "wait", "left"])).toEqual(["U", "W", "L"]);
    expect(decodeSolutionMoves(["U", "W", "L"])).toEqual(["up", "wait", "left"]);
  });
});

describe("levels 1-20 status board", () => {
  it("lists all twenty levels with a status", () => {
    const status = JSON.parse(readFileSync(statusPath, "utf8")) as {
      levels: Array<{ level: number; status: string; bold: number }>;
    };
    expect(status.levels).toHaveLength(20);
    expect(status.levels.map((l) => l.level)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });
});

describe("level 5 Lesson 5 bold autoplay route", () => {
  it("finishes with exact bold 85 remaining", () => {
    const sol = loadSolution(5);
    expect(sol.moveVerified).toBe(true);
    expect(sol.meetsBoldBudget).toBe(true);
    expect(sol.boldTimeRemaining).toBe(85);
    expect(sol.moves?.includes("W")).toBe(true);

    const level = loadLevel(5);
    const result = simulateSolutionLetters(level, sol.moves!);
    expect(result.playerDied, result.deathMessage).toBe(false);
    expect(result.completed).toBe(true);
    expect(result.secondsRemaining).toBe(85);
  });
});

describe("verified bold routes (levels 1-20)", () => {
  const status = JSON.parse(readFileSync(statusPath, "utf8")) as {
    levels: Array<{ level: number; status: string; bold: number }>;
  };
  const verified = status.levels.filter((l) => l.status === "verified_bold");

  for (const entry of verified) {
    it(`level ${entry.level} completes verified route`, () => {
      const sol = loadSolution(entry.level);
      expect(sol.moveVerified).toBe(true);
      expect(sol.moves?.length).toBeGreaterThan(0);
      const level = loadLevel(entry.level);
      const origRandom = Math.random;
      if (sol.rngSeed != null) {
        let step = 0;
        Math.random = () =>
          deterministicAutoplayChoice(sol.rngSeed!, step++, 0x10000000) / 0x10000000;
      }
      try {
        const result = simulateSolutionLetters(level, sol.moves!);
        expect(result.playerDied, result.deathMessage).toBe(false);
        expect(result.completed).toBe(true);
        if (
          level.timeLimit != null &&
          level.timeLimit > 0 &&
          sol.simulatedSecondsRemaining != null
        ) {
          expect(result.secondsRemaining).toBe(sol.simulatedSecondsRemaining);
          expect(result.secondsRemaining).toBe(entry.bold);
        }
      } finally {
        Math.random = origRandom;
      }
    });
  }
});
