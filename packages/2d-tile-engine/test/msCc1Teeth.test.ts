import { describe, expect, it } from "vitest";
import { teethMovesThisBoundary } from "../engine/msCc1/msCc1Teeth.js";

describe("teethMovesThisBoundary", () => {
  it("odd step moves on boundaries 1, 3, 5", () => {
    expect(teethMovesThisBoundary(1, "odd")).toBe(true);
    expect(teethMovesThisBoundary(3, "odd")).toBe(true);
    expect(teethMovesThisBoundary(0, "odd")).toBe(false);
    expect(teethMovesThisBoundary(2, "odd")).toBe(false);
  });

  it("even step moves on boundaries 2, 4, 6", () => {
    expect(teethMovesThisBoundary(2, "even")).toBe(true);
    expect(teethMovesThisBoundary(4, "even")).toBe(true);
    expect(teethMovesThisBoundary(1, "even")).toBe(false);
    expect(teethMovesThisBoundary(0, "even")).toBe(false);
  });
});
