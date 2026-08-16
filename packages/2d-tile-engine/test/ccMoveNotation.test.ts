import { describe, expect, it } from "vitest";
import { parseCcMoveString, parseCcMoveStringMs } from "../engine/ccMoveNotation.js";

describe("parseCcMoveString", () => {
  it("parses counted directions and ignores waits", () => {
    expect(parseCcMoveString("5L3R")).toEqual([
      "left",
      "left",
      "left",
      "left",
      "left",
      "right",
      "right",
      "right",
    ]);
  });

  it("parses lowercase chip steps", () => {
    expect(parseCcMoveString("Lr")).toEqual(["left", "right"]);
  });
});

describe("parseCcMoveStringMs", () => {
  it("counts only uppercase chip steps", () => {
    expect(parseCcMoveStringMs("2L,,l,,l,,L3,2Rr")).toEqual([
      "left",
      "left",
      "left",
      "right",
      "right",
    ]);
  });

  it("treats L3, as a single left step", () => {
    expect(parseCcMoveStringMs("L3,2R")).toEqual(["left", "right", "right"]);
  });

  it("parses LDd,,D3U5R2DR3 fragment (D3U = one D then three U)", () => {
    expect(parseCcMoveStringMs("LDd,,D3U5R2DR3")).toEqual([
      "left",
      "down",
      "down",
      "up",
      "up",
      "up",
      "right",
      "right",
      "right",
      "right",
      "right",
      "down",
      "down",
      "right",
    ]);
  });
});
