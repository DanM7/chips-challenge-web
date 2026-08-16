import { describe, expect, it, vi } from "vitest";
import type { LevelData } from "../engine/types.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import { tryMsCc1Move, msCc1StateFromRun } from "../engine/msCc1/msCc1Movement.js";
import type { MsCc1ButtonPressContext } from "../engine/msCc1/msCc1Buttons.js";
import {
  createMsCc1Monsters,
  tickMsCc1Monsters,
  MS_DEATH_CREATURES,
} from "../engine/msCc1/msCc1Monsters.js";

function monsterCtx(
  overrides: Partial<MsCc1ButtonPressContext> = {},
): MsCc1ButtonPressContext {
  return {
    redButtonArmed: new Set(),
    openTraps: new Set(),
    stuckOnTraps: new Set(),
    heldBrownButtons: new Set(),
    moveBoundary: 0,
    ...overrides,
  };
}

function levelFromGrid(
  cells: Record<string, string>,
  width = 8,
  height = 8,
  lowerCells: Record<string, string> = {},
  monsters: LevelData["monsters"] = [],
): LevelData {
  const upper = Array.from({ length: width * height }, () => "empty");
  const lower = Array.from({ length: width * height }, () => "empty");
  for (const [key, tile] of Object.entries(cells)) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    upper[y * width + x] = tile;
  }
  for (const [key, tile] of Object.entries(lowerCells)) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    lower[y * width + x] = tile;
  }
  return {
    id: "test",
    name: "test",
    width,
    height,
    tileSize: 32,
    layers: { upper, lower },
    playerStart: { x: 0, y: 0 },
    monsters,
  };
}

describe("createMsCc1Monsters", () => {
  it("skips the creature icon sitting on a clone machine", () => {
    const level = levelFromGrid(
      { "2,2": "fireball_w" },
      8,
      8,
      { "2,2": "cloner" },
      [{ x: 2, y: 2, direction: "west" }],
    );
    const monsters = createMsCc1Monsters(level);
    expect(monsters).toHaveLength(0);
  });

  it("loads teeth (frog) from the monster list", () => {
    const level = levelFromGrid(
      { "4,2": "frog_n" },
      8,
      8,
      {},
      [{ x: 4, y: 2, direction: "north" }],
    );
    const monsters = createMsCc1Monsters(level);
    expect(monsters).toHaveLength(1);
    expect(monsters[0]!.kind).toBe("frog");
    expect(monsters[0]!.direction).toBe("north");
  });

  it("loads walkers from the monster list", () => {
    const level = levelFromGrid(
      { "4,2": "walker_n" },
      8,
      8,
      {},
      [{ x: 4, y: 2, direction: "north" }],
    );
    const monsters = createMsCc1Monsters(level);
    expect(monsters).toHaveLength(1);
    expect(monsters[0]!.kind).toBe("walker");
    expect(monsters[0]!.direction).toBe("north");
  });

  it("loads bugs from the monster list in DAT order", () => {
    const level = levelFromGrid(
      { "2,2": "bug_e" },
      8,
      8,
      {},
      [{ x: 2, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    expect(monsters).toHaveLength(1);
    expect(monsters[0]!.kind).toBe("bug");
    expect(monsters[0]!.direction).toBe("east");
  });
});

describe("tickMsCc1Monsters", () => {
  it("bug moves east when left is blocked and forward is clear", () => {
    const level = levelFromGrid(
      {
        "1,1": "wall",
        "1,2": "bug_e",
        "2,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 1, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const tick = tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);
    expect(tick.chipDied).toBe(false);
    expect(monsters[0]!.x).toBe(2);
    expect(monsters[0]!.y).toBe(2);
    expect(getCompositeTile(level, 1, 2)).toBe("empty");
    expect(getCompositeTile(level, 2, 2)).toBe("bug_e");
  });

  it("kills Chip when bug steps onto Chip", () => {
    const level = levelFromGrid(
      {
        "0,1": "wall",
        "0,2": "bug_e",
        "1,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 0, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const tick = tickMsCc1Monsters(level, monsters, { x: 1, y: 2 }, 0);
    expect(tick.chipDied).toBe(true);
    expect(monsters[0]!.x).toBe(1);
    expect(monsters[0]!.y).toBe(2);
  });

  it("bug dies in water", () => {
    const level = levelFromGrid(
      {
        "1,1": "wall",
        "1,2": "bug_e",
      },
      8,
      8,
      { "2,2": "water" },
      [{ x: 1, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(monsters[0]!.alive).toBe(false);
    expect(getCompositeTile(level, 1, 2)).toBe("empty");
    expect(getCompositeTile(level, 2, 2)).toBe("water");
  });

  it("ghost (glider) turns left when forward is blocked", () => {
    const level = levelFromGrid(
      {
        "2,1": "wall",
        "2,2": "ghost_n",
        "1,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 2, y: 2, direction: "north" }],
    );
    const monsters = createMsCc1Monsters(level);
    expect(monsters[0]!.kind).toBe("ghost");
    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);
    expect(monsters[0]!.x).toBe(1);
    expect(monsters[0]!.y).toBe(2);
    expect(monsters[0]!.direction).toBe("west");
    expect(getCompositeTile(level, 2, 2)).toBe("empty");
    expect(getCompositeTile(level, 1, 2)).toBe("ghost_w");
  });

  it("ghost survives water", () => {
    const level = levelFromGrid(
      { "1,2": "ghost_e" },
      8,
      8,
      { "2,2": "water" },
      [{ x: 1, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(monsters[0]!.alive).toBe(true);
    expect(monsters[0]!.x).toBe(2);
    expect(monsters[0]!.y).toBe(2);
  });

  it("glider stepping onto a bomb destroys both glider and bomb", () => {
    const level = levelFromGrid(
      {
        "1,2": "ghost_e",
        "2,2": "bomb",
      },
      8,
      8,
      {},
      [{ x: 1, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const tick = tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(monsters[0]!.alive).toBe(false);
    expect(getCompositeTile(level, 1, 2)).toBe("empty");
    expect(getCompositeTile(level, 2, 2)).toBe("empty");
    expect(tick.cellChanges.some((c) => c.removedTileId === "bomb")).toBe(true);
  });

  it("walker moves forward in a clear corridor", () => {
    const level = levelFromGrid(
      {
        "0,2": "walker_e",
        "1,2": "empty",
        "2,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 0, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);
    expect(monsters[0]!.x).toBe(1);
    expect(monsters[0]!.y).toBe(2);
    expect(monsters[0]!.direction).toBe("east");
  });

  it("walker picks a random open direction when forward is blocked", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const level = levelFromGrid(
      {
        "1,1": "wall",
        "1,2": "walker_n",
        "2,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 1, y: 2, direction: "north" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);
    randomSpy.mockRestore();
    expect(monsters[0]!.x).toBe(2);
    expect(monsters[0]!.y).toBe(2);
    expect(monsters[0]!.direction).toBe("east");
  });

  it("walker dies in water", () => {
    const level = levelFromGrid(
      {
        "0,2": "walker_e",
      },
      8,
      8,
      { "1,2": "water" },
      [{ x: 0, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);
    expect(monsters[0]!.alive).toBe(false);
  });

  it("fireball stepping on a chip leaves the chip when it moves away", () => {
    const level = levelFromGrid(
      {
        "0,2": "fireball_e",
        "1,2": "chip",
        "2,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 0, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);
    expect(monsters[0]!.x).toBe(1);
    expect(cellTile(level, "lower", 1, 2)).toBe("chip");
    expect(getCompositeTile(level, 1, 2)).toBe("fireball_e");

    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);
    expect(monsters[0]!.x).toBe(2);
    expect(getCompositeTile(level, 1, 2)).toBe("chip");
    expect(cellTile(level, "lower", 1, 2)).toBe("empty");
  });

  it("pink ball bounces off a chip without removing it", () => {
    const level = levelFromGrid(
      {
        "1,2": "ball_pink_e",
        "2,2": "chip",
      },
      8,
      8,
      {},
      [{ x: 1, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(monsters[0]!.x).toBe(0);
    expect(monsters[0]!.y).toBe(2);
    expect(monsters[0]!.direction).toBe("west");
    expect(getCompositeTile(level, 2, 2)).toBe("chip");
  });

  it("walker turns away from a chip without removing it", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const level = levelFromGrid(
      {
        "1,2": "walker_n",
        "1,1": "chip",
        "0,1": "empty",
      },
      8,
      8,
      {},
      [{ x: 1, y: 2, direction: "north" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);
    randomSpy.mockRestore();
    expect(getCompositeTile(level, 1, 1)).toBe("chip");
    expect(monsters[0]!.x !== 1 || monsters[0]!.y !== 1).toBe(true);
  });

  it("pink ball bounces when forward is blocked", () => {
    const level = levelFromGrid(
      {
        "2,2": "wall",
        "1,2": "ball_pink_e",
      },
      8,
      8,
      {},
      [{ x: 1, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    expect(monsters[0]!.kind).toBe("ball_pink");
    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(monsters[0]!.direction).toBe("west");
    expect(monsters[0]!.x).toBe(0);
    expect(monsters[0]!.y).toBe(2);
    expect(getCompositeTile(level, 1, 2)).toBe("empty");
    expect(getCompositeTile(level, 0, 2)).toBe("ball_pink_w");
  });

  it("fireball turns right when forward is blocked", () => {
    const level = levelFromGrid(
      {
        "2,1": "wall",
        "2,2": "fireball_n",
        "3,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 2, y: 2, direction: "north" }],
    );
    const monsters = createMsCc1Monsters(level);
    expect(monsters[0]!.kind).toBe("fireball");
    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);
    expect(monsters[0]!.x).toBe(3);
    expect(monsters[0]!.y).toBe(2);
    expect(monsters[0]!.direction).toBe("east");
    expect(getCompositeTile(level, 3, 2)).toBe("fireball_e");
  });

  it("fireball moves through fire", () => {
    const level = levelFromGrid(
      { "1,2": "fireball_e" },
      8,
      8,
      { "2,2": "fire" },
      [{ x: 1, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(monsters[0]!.alive).toBe(true);
    expect(monsters[0]!.x).toBe(2);
    expect(monsters[0]!.y).toBe(2);
  });

  it("pink ball crossing an open toggle wall leaves the wall on the map", () => {
    const level = levelFromGrid(
      {
        "1,2": "ball_pink_e",
        "2,2": "block_toggle_open",
        "3,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 1, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(monsters[0]!.x).toBe(2);
    expect(cellTile(level, "lower", 2, 2)).toBe("block_toggle_open");
    expect(getCompositeTile(level, 2, 2)).toBe("ball_pink_e");

    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(monsters[0]!.x).toBe(3);
    expect(getCompositeTile(level, 2, 2)).toBe("block_toggle_open");
  });

  it("green button remains after a creature steps on it", () => {
    const level = levelFromGrid(
      {
        "1,2": "ball_pink_e",
        "2,2": "button_green",
        "3,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 1, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(cellTile(level, "lower", 2, 2)).toBe("button_green");

    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0);
    expect(getCompositeTile(level, 2, 2)).toBe("button_green");
  });
});

describe("teeth (frog)", () => {
  it("does not move on the first even-step boundary", () => {
    const level = levelFromGrid(
      {
        "5,2": "frog_e",
        "0,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 5, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const ctx = monsterCtx({ stepParity: "even" });
    tickMsCc1Monsters(level, monsters, { x: 0, y: 2 }, 0, undefined, ctx);
    expect(monsters[0]!.x).toBe(5);
    expect(ctx.moveBoundary).toBe(1);
  });

  it("chases Chip west on the second even-step boundary", () => {
    const level = levelFromGrid(
      {
        "5,2": "frog_e",
        "4,2": "empty",
        "3,2": "empty",
        "2,2": "empty",
        "1,2": "empty",
        "0,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 5, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const ctx = monsterCtx({ stepParity: "even" });
    tickMsCc1Monsters(level, monsters, { x: 0, y: 2 }, 0, undefined, ctx);
    tickMsCc1Monsters(level, monsters, { x: 0, y: 2 }, 0, undefined, ctx);
    expect(monsters[0]!.x).toBe(4);
    expect(monsters[0]!.direction).toBe("west");
    expect(getCompositeTile(level, 4, 2)).toBe("frog_w");
  });

  it("moves on the first odd-step boundary toward Chip", () => {
    const level = levelFromGrid(
      {
        "3,2": "frog_e",
        "2,2": "empty",
        "1,2": "empty",
        "0,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 3, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const ctx = monsterCtx({ stepParity: "odd" });
    tickMsCc1Monsters(level, monsters, { x: 0, y: 2 }, 0, undefined, ctx);
    expect(monsters[0]!.x).toBe(2);
  });

  it("is blocked by gravel and dirt", () => {
    const level = levelFromGrid(
      {
        "3,2": "frog_e",
        "2,2": "gravel",
        "1,2": "dirt",
        "0,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 3, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const ctx = monsterCtx({ stepParity: "odd" });
    tickMsCc1Monsters(level, monsters, { x: 0, y: 2 }, 0, undefined, ctx);
    expect(monsters[0]!.x).toBe(3);
  });

  it("does not move on idle clock when advanceTeethBoundary is false", () => {
    const level = levelFromGrid(
      {
        "3,2": "frog_e",
        "2,2": "empty",
        "1,2": "empty",
        "0,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 3, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const ctx = monsterCtx({ stepParity: "odd" });
    tickMsCc1Monsters(level, monsters, { x: 0, y: 2 }, 0, undefined, ctx, {
      advanceTeethBoundary: false,
    });
    tickMsCc1Monsters(level, monsters, { x: 0, y: 2 }, 0, undefined, ctx, {
      advanceTeethBoundary: false,
    });
    expect(monsters[0]!.x).toBe(3);
    expect(ctx.moveBoundary).toBe(0);
  });

  it("does not chase Chip while he is sliding (chipIgnoresTeeth)", () => {
    const level = levelFromGrid(
      {
        "3,2": "frog_e",
        "2,2": "empty",
        "1,2": "empty",
        "0,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 3, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const ctx = monsterCtx({ stepParity: "odd", chipIgnoresTeeth: true });
    tickMsCc1Monsters(level, monsters, { x: 0, y: 2 }, 0, undefined, ctx);
    expect(monsters[0]!.x).toBe(3);
    expect(ctx.moveBoundary).toBe(1);
  });

  it("kills Chip when stepping onto Chip", () => {
    const level = levelFromGrid(
      {
        "2,2": "frog_e",
        "1,2": "empty",
      },
      8,
      8,
      {},
      [{ x: 2, y: 2, direction: "east" }],
    );
    const monsters = createMsCc1Monsters(level);
    const ctx = monsterCtx({ stepParity: "odd" });
    const tick = tickMsCc1Monsters(level, monsters, { x: 1, y: 2 }, 0, undefined, ctx);
    expect(tick.chipDied).toBe(true);
    expect(monsters[0]!.x).toBe(1);
  });
});

describe("Chip vs monsters", () => {
  it("Chip dies when stepping onto a bug", () => {
    const level = levelFromGrid(
      {
        "0,2": "chip_s",
        "1,2": "bug_w",
      },
      8,
      8,
      {},
      [{ x: 1, y: 2, direction: "west" }],
    );
    const r = tryMsCc1Move(level, { x: 0, y: 2 }, "right", msCc1StateFromRun([], 0));
    expect(r.moved).toBe(true);
    expect(r.playerDied).toBe(true);
    expect(r.deathMessage).toBe(MS_DEATH_CREATURES);
  });
});
