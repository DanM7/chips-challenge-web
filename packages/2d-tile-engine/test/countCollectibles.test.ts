import { describe, expect, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import { chipsLeftAtLevelStart, countCollectiblesOnMap } from "../engine/countCollectibles.js";

function levelWithChips(chipsRequired: number, visibleChips: number): LevelData {
  const upper = Array.from({ length: 32 * 32 }, () => "empty");
  for (let i = 0; i < visibleChips; i++) {
    upper[i] = "chip";
  }
  return {
    id: "test",
    name: "test",
    width: 32,
    height: 32,
    tileSize: 32,
    chipsRequired,
    layers: { upper, lower: Array.from({ length: 32 * 32 }, () => "empty") },
    playerStart: { x: 0, y: 0 },
    hud: { levelTitle: "test", collectiblesOnMap: visibleChips, chipCounter: { mode: "remaining", initial: chipsRequired } },
  };
}

describe("chipsLeftAtLevelStart", () => {
  it("uses DAT chips-required when chips are hidden under blocks", () => {
    const level = levelWithChips(9, 5);
    expect(countCollectiblesOnMap(level)).toBe(5);
    expect(chipsLeftAtLevelStart(level)).toBe(9);
  });
});
