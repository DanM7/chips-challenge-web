import { describe, expect, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import { applyButtonPressAt, type MsCc1ButtonPressContext } from "../engine/msCc1/msCc1Buttons.js";
import { createMsCc1Monsters, tickMsCc1Monsters } from "../engine/msCc1/msCc1Monsters.js";
import {
  applyBrownButtonHeldByBlock,
  isCreatureStuckOnTrap,
} from "../engine/msCc1/msCc1Traps.js";
import { tryMsCc1Move, tryMsCc1SingleStep } from "../engine/msCc1/msCc1Movement.js";

function buttonCtx(): MsCc1ButtonPressContext {
  return {
    redButtonArmed: new Set(),
    openTraps: new Set(),
    stuckOnTraps: new Set(),
    heldBrownButtons: new Set(),
    moveBoundary: 0,
  };
}

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
    monsters: [],
  };
}

describe("msCc1 trap stuck", () => {
  it("Chip stepping a closed trap becomes stuck until the brown button opens it", () => {
    const level = levelFromGrid(
      {
        "0,1": "chip",
        "1,1": "trap",
        "0,0": "button_brown",
      },
      8,
      8,
      [{ button: { x: 0, y: 0 }, trap: { x: 1, y: 1 } }],
    );
    level.playerStart = { x: 0, y: 1 };
    const ctx = buttonCtx();

    const ontoTrap = tryMsCc1Move(
      level,
      { x: 0, y: 1 },
      "right",
      { keys: [], tools: [], chipsRemainingOnMap: 0 },
      ctx,
    );
    expect(ontoTrap.moved).toBe(true);
    expect(ontoTrap.position).toEqual({ x: 1, y: 1 });
    expect(isCreatureStuckOnTrap(ctx, 1, 1)).toBe(true);

    const stuckMove = tryMsCc1Move(
      level,
      { x: 1, y: 1 },
      "up",
      ontoTrap.state,
      ctx,
    );
    expect(stuckMove.moved).toBe(false);

    applyButtonPressAt(
      level,
      { x: 1, y: 1 },
      { x: 0, y: 0 },
      [],
      [],
      ctx,
    );
    expect(ctx.openTraps.has("1,1")).toBe(true);
    expect(isCreatureStuckOnTrap(ctx, 1, 1)).toBe(false);

    const freeMove = tryMsCc1SingleStep(
      level,
      { x: 1, y: 1 },
      "up",
      ontoTrap.state,
      ctx,
    );
    expect(freeMove.moved).toBe(true);
    expect(freeMove.position).toEqual({ x: 1, y: 0 });
  });

  it("a block on a brown button opens the trap and releases a stuck monster", () => {
    const level = levelFromGrid(
      {
        "1,0": "button_brown",
      },
      8,
      8,
      [{ button: { x: 1, y: 0 }, trap: { x: 3, y: 0 } }],
    );
    level.layers.upper[1] = "block_movable";
    level.layers.lower[1] = "button_brown";
    level.layers.upper[3] = "bug_n";
    level.layers.lower[3] = "trap";
    level.monsters = [{ x: 3, y: 0, direction: "north" }];
    const monsters = createMsCc1Monsters(level);
    const ctx = buttonCtx();
    ctx.stuckOnTraps.add("3,0");

    const changes: { x: number; y: number }[] = [];
    applyBrownButtonHeldByBlock(level, 1, 0, monsters, changes, ctx);

    expect(ctx.openTraps.has("3,0")).toBe(true);
    expect(ctx.heldBrownButtons.has("1,0")).toBe(true);
    expect(ctx.stuckOnTraps.has("3,0")).toBe(false);
  });

  it("monsters on a closed trap cannot move until the trap opens", () => {
    const level = levelFromGrid(
      {
        "1,0": "button_brown",
      },
      8,
      8,
      [{ button: { x: 1, y: 0 }, trap: { x: 2, y: 0 } }],
    );
    level.layers.upper[2] = "bug_n";
    level.layers.lower[2] = "trap";
    level.monsters = [{ x: 2, y: 0, direction: "east" }];
    const monsters = createMsCc1Monsters(level);
    const ctx = buttonCtx();
    ctx.stuckOnTraps.add("2,0");

    tickMsCc1Monsters(
      level,
      monsters,
      { x: 0, y: 0 },
      0,
      undefined,
      ctx,
    );

    const bug = monsters.find((m) => m.kind === "bug")!;
    expect(bug.x).toBe(2);
    expect(bug.y).toBe(0);
  });
});
