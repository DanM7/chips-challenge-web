import { describe, expect, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import { createMsCc1Monsters, tickMsCc1Monsters } from "../engine/msCc1/msCc1Monsters.js";
import type { MsCc1ButtonPressContext } from "../engine/msCc1/msCc1Buttons.js";

/** Lesson 8 row 14: chip west, teeth east; dirt/gravel between. */
function lesson8RowCtx(): MsCc1ButtonPressContext {
  return {
    redButtonArmed: new Set(),
    openTraps: new Set(),
    stuckOnTraps: new Set(),
    heldBrownButtons: new Set(),
    moveBoundary: 0,
    stepParity: "even",
  };
}

function lesson8Monsters(): { level: LevelData; monsters: ReturnType<typeof createMsCc1Monsters> } {
  const width = 12;
  const height = 16;
  const upper = Array.from({ length: width * height }, () => "empty");
  const set = (x: number, y: number, id: string) => {
    upper[y * width + x] = id;
  };
  set(1, 14, "chip_s");
  set(2, 14, "gravel");
  set(3, 14, "gravel");
  set(4, 14, "dirt");
  set(5, 14, "dirt");
  set(9, 14, "frog_n");
  const level: LevelData = {
    id: "lesson-8",
    name: "Lesson 8",
    width,
    height,
    layers: { lower: Array(width * height).fill("floor"), upper },
    playerStart: { x: 1, y: 14 },
    monsters: [{ x: 9, y: 14, direction: "north" }],
  };
  return { level, monsters: createMsCc1Monsters(level) };
}

describe("Lesson 8 teeth vs idle clock (advanceTeethBoundary)", () => {
  it("idle clock ticks do not move teeth", () => {
    const { level, monsters } = lesson8Monsters();
    const ctx = lesson8RowCtx();
    const chip = { x: 1, y: 14 };

    for (let i = 0; i < 12; i++) {
      tickMsCc1Monsters(level, monsters, chip, 1, undefined, ctx, {
        advanceTeethBoundary: false,
      });
    }
    expect(monsters[0]!.x).toBe(9);
    expect(ctx.moveBoundary).toBe(0);
  });

  it("chip-move ticks advance teeth on even boundaries", () => {
    const { level, monsters } = lesson8Monsters();
    const ctx = lesson8RowCtx();
    const chip = { x: 1, y: 14 };

    tickMsCc1Monsters(level, monsters, chip, 1, undefined, ctx, {
      advanceTeethBoundary: true,
    });
    expect(monsters[0]!.x).toBe(9);
    tickMsCc1Monsters(level, monsters, chip, 1, undefined, ctx, {
      advanceTeethBoundary: true,
    });
    expect(monsters[0]!.x).toBe(8);
  });
});
