import { describe, expect, it } from "vitest";
import {
  forceFloorDirection,
  iceCornerExitDirection,
  isTerrainVisibleUnderChip,
  slideDirectionAfterLanding,
} from "../engine/msCc1/msCc1Sliding.js";
import { msCc1StateFromRun } from "../engine/msCc1/msCc1Movement.js";

describe("msCc1Sliding", () => {
  it("flags terrain visible under Chip", () => {
    expect(isTerrainVisibleUnderChip("ice")).toBe(true);
    expect(isTerrainVisibleUnderChip("force_s")).toBe(true);
    expect(isTerrainVisibleUnderChip("water")).toBe(true);
    expect(isTerrainVisibleUnderChip("fire")).toBe(true);
    expect(isTerrainVisibleUnderChip("empty")).toBe(false);
  });

  it("maps force floor tiles to directions", () => {
    expect(forceFloorDirection("force_n")).toBe("up");
    expect(forceFloorDirection("force_w")).toBe("left");
  });

  it("continues ice slide and turns on corners", () => {
    const state = msCc1StateFromRun([], 0);
    expect(slideDirectionAfterLanding("ice", state, "right")).toBe("right");
    expect(slideDirectionAfterLanding("ice_se", state, "left")).toBe("down");
    expect(slideDirectionAfterLanding("ice_ne", state, "down")).toBe("right");
    expect(slideDirectionAfterLanding("empty", state, "right")).toBeNull();
  });

  it("maps ice corner entry to exit", () => {
    expect(iceCornerExitDirection("ice_se", "left")).toBe("down");
    expect(iceCornerExitDirection("ice_ne", "down")).toBe("right");
    expect(iceCornerExitDirection("ice_se", "right")).toBeNull();
  });
});
