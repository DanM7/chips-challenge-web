import { describe, expect, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import { getCompositeTile, isBlockedCell } from "../engine/levelRuntime.js";
import {
  applyButtonPressAt,
  collectRedButtonCells,
  toggleAllToggleWalls,
} from "../engine/msCc1/msCc1Buttons.js";
import {
  createMsCc1Monsters,
  tickMsCc1Monsters,
} from "../engine/msCc1/msCc1Monsters.js";

function levelFromGrid(
  cells: Record<string, string>,
  width = 5,
  height = 5,
): LevelData {
  const upper = Array.from({ length: width * height }, () => "empty");
  const lower = Array.from({ length: width * height }, () => "empty");
  for (const [key, tile] of Object.entries(cells)) {
    const [xs, ys] = key.split(",");
    upper[Number(ys) * width + Number(xs)] = tile;
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

describe("msCc1Buttons", () => {
  it("green button toggles all toggle walls", () => {
    const level = levelFromGrid({
      "1,1": "button_green",
      "3,1": "block_toggle_closed",
    });
    const changes: { placedTileId?: string }[] = [];
    toggleAllToggleWalls(level, changes);
    expect(getCompositeTile(level, 3, 1)).toBe("block_toggle_open");
    expect(isBlockedCell(level, 3, 1)).toBe(false);

    toggleAllToggleWalls(level, changes);
    expect(getCompositeTile(level, 3, 1)).toBe("block_toggle_closed");
    expect(isBlockedCell(level, 3, 1)).toBe(true);
  });

  it("blue button reverses tanks and they can move", () => {
    const level = levelFromGrid(
      {
        "0,2": "tank_n",
        "0,1": "empty",
        "0,0": "wall",
        "2,2": "button_blue",
      },
      4,
      4,
    );
    level.monsters = [{ x: 0, y: 2, direction: "north" }];
    const monsters = createMsCc1Monsters(level);
    expect(monsters[0]?.direction).toBe("north");

    const changes: { placedTileId?: string; removedTileId?: string }[] = [];
    applyButtonPressAt(level, { x: 2, y: 1 }, { x: 2, y: 2 }, monsters, changes, {
      redButtonArmed: collectRedButtonCells(level),
      openTraps: new Set<string>(),
      stuckOnTraps: new Set<string>(),
      heldBrownButtons: new Set<string>(),
      moveBoundary: 0,
    });
    expect(monsters[0]?.direction).toBe("south");
    expect(monsters[0]?.stopped).toBe(false);

    const tick = tickMsCc1Monsters(level, monsters, { x: 3, y: 3 }, 0);
    expect(monsters[0]?.y).toBe(3);
    expect(getCompositeTile(level, 0, 3)).toMatch(/^tank_/);
  });
});
