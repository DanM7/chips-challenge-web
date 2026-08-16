import { describe, expect, it } from "vitest";
import { decodeSolutionMoves, encodeSolutionMoves } from "../engine/solutionMoves.js";

describe("solutionMoves", () => {
  it("round-trips directions as U/D/L/R letters", () => {
    const moves = ["up", "down", "left", "right"] as const;
    expect(encodeSolutionMoves([...moves])).toEqual(["U", "D", "L", "R"]);
    expect(decodeSolutionMoves(["U", "D", "L", "R"])).toEqual([...moves]);
  });

  it("round-trips waits as W", () => {
    expect(encodeSolutionMoves(["up", "wait", "left"])).toEqual(["U", "W", "L"]);
    expect(decodeSolutionMoves(["U", "W", "L"])).toEqual(["up", "wait", "left"]);
  });

  it("still decodes legacy spelled-out moves", () => {
    expect(decodeSolutionMoves(["up", "left"])).toEqual(["up", "left"]);
  });
});
