import { describe, expect, it } from "vitest";
import { directionFromStickDeflection } from "../src/ui/TouchJoystick";

describe("directionFromStickDeflection", () => {
  it("returns null inside dead zone", () => {
    expect(directionFromStickDeflection(2, 3, 10)).toBeNull();
  });

  it("maps diagonals to dominant cardinal", () => {
    expect(directionFromStickDeflection(30, 10, 8)).toBe("right");
    expect(directionFromStickDeflection(-30, 10, 8)).toBe("left");
    expect(directionFromStickDeflection(10, 30, 8)).toBe("down");
    expect(directionFromStickDeflection(10, -30, 8)).toBe("up");
    expect(directionFromStickDeflection(20, 20, 8)).toBe("right");
    expect(directionFromStickDeflection(-20, 20, 8)).toBe("left");
  });
});
