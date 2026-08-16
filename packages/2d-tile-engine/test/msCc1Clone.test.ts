import { describe, expect, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import {
  applyButtonPressAt,
  collectRedButtonCells,
} from "../engine/msCc1/msCc1Buttons.js";
import { createMsCc1Monsters, tickMsCc1Monsters } from "../engine/msCc1/msCc1Monsters.js";
import { cellTile } from "../engine/levelRuntime.js";

function levelFromGrid(
  cells: Record<string, string>,
  lowerCells: Record<string, string> = {},
  width = 8,
  height = 8,
): LevelData {
  const upper = Array.from({ length: width * height }, () => "empty");
  const lower = Array.from({ length: width * height }, () => "empty");
  for (const [key, tile] of Object.entries(cells)) {
    const [xs, ys] = key.split(",");
    upper[Number(ys) * width + Number(xs)] = tile;
  }
  for (const [key, tile] of Object.entries(lowerCells)) {
    const [xs, ys] = key.split(",");
    lower[Number(ys) * width + Number(xs)] = tile;
  }
  return {
    id: "test",
    name: "test",
    width,
    height,
    tileSize: 32,
    layers: { upper, lower },
    playerStart: { x: 0, y: 0 },
  };
}

describe("msCc1Clone", () => {
  it("does not treat clone-machine preview as a moving monster", () => {
    const level = levelFromGrid(
      { "3,3": "fireball_w" },
      { "3,3": "cloner" },
    );
    level.monsters = [{ x: 3, y: 3, direction: "west" }];
    const monsters = createMsCc1Monsters(level);
    expect(monsters).toHaveLength(0);
    expect(cellTile(level, "upper", 3, 3)).toBe("fireball_w");
  });

  it("red button clones fireball west from clone machine (lesson 5 layout)", () => {
    const level = levelFromGrid(
      {
        "3,2": "button_red",
        "3,3": "fireball_w",
      },
      { "3,3": "cloner" },
    );
    level.cloneLinks = [{ button: { x: 3, y: 2 }, clone: { x: 3, y: 3 } }];
    level.monsters = [{ x: 3, y: 3, direction: "west" }];

    const monsters = createMsCc1Monsters(level);
    expect(monsters).toHaveLength(0);

    const changes: { x: number; y: number; placedTileId?: string }[] = [];
    const ctx = {
      redButtonArmed: collectRedButtonCells(level),
      openTraps: new Set<string>(),
      stuckOnTraps: new Set<string>(),
      heldBrownButtons: new Set<string>(),
      moveBoundary: 0,
    };
    applyButtonPressAt(level, { x: 3, y: 1 }, { x: 3, y: 2 }, monsters, changes, ctx);

    expect(monsters).toHaveLength(1);
    expect(monsters[0]!.x).toBe(2);
    expect(monsters[0]!.y).toBe(3);
    expect(monsters[0]!.kind).toBe("fireball");
    expect(getCompositeTile(level, 2, 3)).toBe("fireball_w");
  });

  it("pink ball stepping on red button clones fireball and leaves button when it moves away", () => {
    const level = levelFromGrid(
      {
        "2,2": "ball_pink_e",
        "3,2": "button_red",
        "3,3": "fireball_w",
      },
      { "3,3": "cloner" },
    );
    level.cloneLinks = [{ button: { x: 3, y: 2 }, clone: { x: 3, y: 3 } }];
    level.monsters = [{ x: 2, y: 2, direction: "east" }];

    const monsters = createMsCc1Monsters(level);
    const ctx = {
      redButtonArmed: collectRedButtonCells(level),
      openTraps: new Set<string>(),
      stuckOnTraps: new Set<string>(),
      heldBrownButtons: new Set<string>(),
      moveBoundary: 0,
    };
    const afterStep = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      cellChanges: { x: number; y: number }[],
    ) => {
      applyButtonPressAt(level, from, to, monsters, cellChanges, ctx);
    };

    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0, afterStep);
    expect(monsters).toHaveLength(2);
    expect(getCompositeTile(level, 3, 2)).toBe("ball_pink_e");
    expect(cellTile(level, "lower", 3, 2)).toBe("button_red");

    monsters[0]!.direction = "west";
    tickMsCc1Monsters(level, monsters, { x: 0, y: 0 }, 0, afterStep);
    expect(getCompositeTile(level, 3, 2)).toBe("button_red");
    expect(cellTile(level, "lower", 3, 2)).toBe("empty");
  });

  it("fireball passing over fire keeps the fire tile on the map", () => {
    const level = levelFromGrid({
      "0,1": "fireball_e",
      "1,1": "fire",
    });
    level.monsters = [{ x: 0, y: 1, direction: "east" }];

    const monsters = createMsCc1Monsters(level);
    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);

    expect(getCompositeTile(level, 1, 1)).toBe("fireball_e");
    expect(cellTile(level, "lower", 1, 1)).toBe("fire");
    expect(cellTile(level, "upper", 1, 1)).toBe("fireball_e");

    monsters[0]!.direction = "east";
    tickMsCc1Monsters(level, monsters, { x: 5, y: 5 }, 0);

    expect(getCompositeTile(level, 1, 1)).toBe("fire");
    expect(cellTile(level, "lower", 1, 1)).toBe("fire");
    expect(cellTile(level, "upper", 1, 1)).toBe("empty");
  });

  it("red button clones again after the presser leaves and returns", () => {
    const level = levelFromGrid(
      {
        "3,2": "button_red",
        "3,3": "fireball_w",
      },
      { "3,3": "cloner" },
    );
    level.cloneLinks = [{ button: { x: 3, y: 2 }, clone: { x: 3, y: 3 } }];
    level.monsters = [{ x: 3, y: 3, direction: "west" }];

    const monsters = createMsCc1Monsters(level);
    const ctx = {
      redButtonArmed: collectRedButtonCells(level),
      openTraps: new Set<string>(),
      stuckOnTraps: new Set<string>(),
      heldBrownButtons: new Set<string>(),
      moveBoundary: 0,
    };

    applyButtonPressAt(level, { x: 3, y: 1 }, { x: 3, y: 2 }, monsters, [], ctx);
    expect(monsters).toHaveLength(1);

    applyButtonPressAt(level, { x: 3, y: 2 }, { x: 3, y: 1 }, monsters, [], ctx);
    expect(ctx.redButtonArmed.has("3,2")).toBe(true);

    const spawned = monsters[0]!;
    level.layers.upper[spawned.y * level.width + spawned.x] = "empty";
    spawned.x = 5;
    spawned.y = 5;
    level.layers.upper[spawned.y * level.width + spawned.x] = spawned.tileId;

    applyButtonPressAt(level, { x: 3, y: 1 }, { x: 3, y: 2 }, monsters, [], ctx);
    expect(monsters).toHaveLength(2);
  });

  it("brown button opens linked trap without removing it", () => {
    const level = levelFromGrid({
      "1,1": "button_brown",
      "3,1": "trap",
    });
    level.trapLinks = [{ button: { x: 1, y: 1 }, trap: { x: 3, y: 1 } }];

    const changes: { removedTileId?: string }[] = [];
    const ctx = {
      redButtonArmed: new Set<string>(),
      openTraps: new Set<string>(),
      stuckOnTraps: new Set<string>(),
      heldBrownButtons: new Set<string>(),
      moveBoundary: 0,
    };
    applyButtonPressAt(
      level,
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      [],
      changes,
      ctx,
    );
    expect(getCompositeTile(level, 3, 1)).toBe("trap");
    expect(ctx.openTraps.has("3,1")).toBe(true);
  });
});
