import { describe, expect, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import { getCompositeTile, cellTile } from "../engine/levelRuntime.js";
import { createMsCc1Monsters, tickMsCc1Monsters } from "../engine/msCc1/msCc1Monsters.js";
import { applyButtonPressAt } from "../engine/msCc1/msCc1Buttons.js";
import { isCreatureStuckOnTrap } from "../engine/msCc1/msCc1Traps.js";

function levelFromGrid(
  cells: Record<string, string>,
  width = 8,
  height = 8,
  trapLinks: LevelData["trapLinks"] = [],
): LevelData {
  const upper = Array.from({ length: width * height }, () => "empty");
  const lower = Array.from({ length: width * height }, () => "empty");
  for (const [key, tile] of Object.entries(cells)) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    upper[y * width + x] = tile;
  }
  return {
    id: "test",
    name: "test",
    width,
    height,
    tileSize: 32,
    layers: { upper, lower },
    playerStart: { x: 0, y: 0 },
    trapLinks,
    monsters: [{ x: 3, y: 3, direction: "north" }],
  };
}

function emptyCtx() {
  return {
    redButtonArmed: new Set<string>(),
    openTraps: new Set<string>(),
    stuckOnTraps: new Set<string>(),
    heldBrownButtons: new Set<string>(),
    moveBoundary: 0,
  };
}

describe("msCc1Traps", () => {
  it("does not move the glider onto the brown button at level start", () => {
    const level = levelFromGrid(
      {
        "1,1": "button_brown",
        "3,1": "trap",
        "3,3": "ghost_n",
      },
      8,
      8,
      [{ button: { x: 1, y: 1 }, trap: { x: 3, y: 1 } }],
    );
    const monsters = createMsCc1Monsters(level);
    const glider = monsters.find((m) => m.kind === "ghost");
    expect(glider?.x).toBe(3);
    expect(glider?.y).toBe(3);
    expect(getCompositeTile(level, 1, 1)).toBe("button_brown");
  });

  it("pressing a brown button opens the trap and releases a stuck glider (no teleport)", () => {
    const level = levelFromGrid(
      {
        "1,1": "button_brown",
        "3,1": "trap",
        "1,3": "button_brown",
        "3,3": "trap",
        "3,4": "ghost_n",
      },
      8,
      8,
      [
        { button: { x: 1, y: 1 }, trap: { x: 3, y: 1 } },
        { button: { x: 1, y: 3 }, trap: { x: 3, y: 3 } },
      ],
    );
    level.monsters = [{ x: 3, y: 4, direction: "north" }];
    const monsters = createMsCc1Monsters(level);
    const ctx = emptyCtx();
    const glider = monsters.find((m) => m.kind === "ghost")!;

    tickMsCc1Monsters(
      level,
      monsters,
      { x: 0, y: 0 },
      0,
      (from, to, changes) => applyButtonPressAt(level, from, to, monsters, changes, ctx),
      ctx,
    );
    expect(glider.x).toBe(3);
    expect(glider.y).toBe(3);
    expect(isCreatureStuckOnTrap(ctx, 3, 3)).toBe(true);

    applyButtonPressAt(level, { x: 1, y: 2 }, { x: 1, y: 3 }, monsters, [], ctx);

    expect(ctx.openTraps.has("3,3")).toBe(true);
    expect(isCreatureStuckOnTrap(ctx, 3, 3)).toBe(false);
    expect(glider.x).toBe(3);
    expect(glider.y).toBe(3);
    expect(getCompositeTile(level, 3, 3)).toMatch(/^ghost_/);
  });

  it("after both traps open, glider walks north toward bombs", () => {
    const level = levelFromGrid(
      {
        "2,1": "wall",
        "2,2": "button_brown",
        "4,2": "trap",
        "2,4": "button_brown",
        "4,4": "trap",
        "4,5": "ghost_n",
      },
      8,
      8,
      [
        { button: { x: 2, y: 2 }, trap: { x: 4, y: 2 } },
        { button: { x: 2, y: 4 }, trap: { x: 4, y: 4 } },
      ],
    );
    level.monsters = [{ x: 4, y: 5, direction: "north" }];
    const monsters = createMsCc1Monsters(level);
    const ctx = emptyCtx();
    const glider = monsters.find((m) => m.kind === "ghost")!;

    const afterStep = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      changes: { x: number; y: number }[],
    ) => applyButtonPressAt(level, from, to, monsters, changes, ctx);

    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0, afterStep, ctx);
    expect(isCreatureStuckOnTrap(ctx, 4, 4)).toBe(true);

    applyButtonPressAt(level, { x: 2, y: 3 }, { x: 2, y: 4 }, monsters, [], ctx);
    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0, afterStep, ctx);
    expect(glider.y).toBeLessThan(4);

    // Walk into second trap and stick, then release
    for (let i = 0; i < 4; i++) {
      tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0, afterStep, ctx);
    }
    if (isCreatureStuckOnTrap(ctx, 4, 2)) {
      applyButtonPressAt(level, { x: 2, y: 1 }, { x: 2, y: 2 }, monsters, [], ctx);
      tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0, afterStep, ctx);
    }

    expect(glider.alive).toBe(true);
    expect(glider.y).toBeLessThanOrEqual(2);
  });
});
