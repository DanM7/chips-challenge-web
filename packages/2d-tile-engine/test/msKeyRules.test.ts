import { describe, expect, it } from "vitest";
import { isKeyConsumedWhenOpeningDoor } from "../tile-engine/tiles.js";

describe("MS key rules", () => {
  it("green keys are reusable for multiple green doors", () => {
    expect(isKeyConsumedWhenOpeningDoor("key_green")).toBe(false);
  });

  it("blue, red, and yellow keys are consumed per door", () => {
    expect(isKeyConsumedWhenOpeningDoor("key_blue")).toBe(true);
    expect(isKeyConsumedWhenOpeningDoor("key_red")).toBe(true);
    expect(isKeyConsumedWhenOpeningDoor("key_yellow")).toBe(true);
  });
});
