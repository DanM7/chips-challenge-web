import { describe, expect, it } from "vitest";
import {
  buildMsLevelScoreBreakdown,
  computeMsLevelBonus,
  computeMsLevelScore,
  computeMsTimeBonus,
  msVictoryMessage,
} from "../engine/msCc1/msCc1Scoring.js";

describe("computeMsTimeBonus", () => {
  it("is seconds remaining times 10", () => {
    expect(computeMsTimeBonus(88)).toBe(880);
  });

  it("is zero when untimed or exhausted", () => {
    expect(computeMsTimeBonus(null)).toBe(0);
    expect(computeMsTimeBonus(0)).toBe(0);
  });
});

describe("computeMsLevelBonus", () => {
  it("is level number times 500 on first try", () => {
    expect(computeMsLevelBonus(3, 0)).toBe(1500);
    expect(computeMsLevelBonus(18, 0)).toBe(9000);
  });

  it("reduces by 20% per death or restart", () => {
    expect(computeMsLevelBonus(3, 1)).toBe(1200);
    expect(computeMsLevelBonus(3, 2)).toBe(960);
  });

  it("stops decreasing below 500", () => {
    expect(computeMsLevelBonus(1, 10)).toBe(500);
  });
});

describe("msVictoryMessage", () => {
  it("matches MS attempt tiers", () => {
    expect(msVictoryMessage(1)).toBe("Yowser! First Try!");
    expect(msVictoryMessage(2)).toBe("Go Bit Buster!");
    expect(msVictoryMessage(4)).toBe("Finished! Good Work!");
    expect(msVictoryMessage(6)).toBe("At last! You did it!");
  });
});

describe("buildMsLevelScoreBreakdown", () => {
  it("sums level score into total", () => {
    const breakdown = buildMsLevelScoreBreakdown({
      levelNumber: 3,
      secondsRemaining: 88,
      attemptCount: 1,
      priorTotalScore: 5000,
    });
    expect(breakdown.timeBonus).toBe(880);
    expect(breakdown.levelBonus).toBe(1500);
    expect(breakdown.levelScore).toBe(2380);
    expect(breakdown.totalScore).toBe(7380);
    expect(computeMsLevelScore(breakdown.timeBonus, breakdown.levelBonus)).toBe(
      breakdown.levelScore,
    );
  });
});
