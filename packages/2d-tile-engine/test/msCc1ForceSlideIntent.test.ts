import { describe, expect, it } from "vitest";
import {
  forceFloorDirection,
  resolveForceSlideIntent,
} from "../engine/msCc1/msCc1Sliding.js";
import { moveIntentFromDirection } from "../engine/moveIntent.js";

describe("resolveForceSlideIntent", () => {
  it("returns held input when it opposes force (MS override)", () => {
    const force = moveIntentFromDirection(forceFloorDirection("force_n")!);
    expect(resolveForceSlideIntent(force, "down")).toEqual(
      moveIntentFromDirection("down"),
    );
  });

  it("combines perpendicular held input with force", () => {
    const force = moveIntentFromDirection(forceFloorDirection("force_s")!);
    expect(resolveForceSlideIntent(force, "right")).toEqual({ dx: 1, dy: 1 });
  });
});
