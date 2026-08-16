import { describe, expect, it } from "vitest";
import {
  doorToKeyId,
  getFloorTileId,
  getCompositeTile,
  getLowerTileUnderMonster,
  isBlockedCell,
  isDoorTile,
  removeCollectibleAt,
  removeTileAt,
} from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";

function cellLevel(upper: string[], lower: string[]): LevelData {
  return {
    id: "test",
    name: "test",
    width: 1,
    height: 1,
    layers: { upper, lower },
  };
}

describe("levelRuntime", () => {
  it("getFloorTileId returns lower layer under a chip", () => {
    const level = cellLevel(["chip"], ["empty"]);
    expect(getFloorTileId(level, 0, 0)).toBe("empty");
  });

  it("removeCollectibleAt reveals empty floor composite", () => {
    const level = cellLevel(["chip"], ["empty"]);
    removeCollectibleAt(level, 0, 0, "chip");
    expect(getCompositeTile(level, 0, 0)).toBe("empty");
    expect(getFloorTileId(level, 0, 0)).toBe("empty");
  });

  it("doors block movement and map to key ids", () => {
    const level = cellLevel(["door_blue"], ["empty"]);
    expect(isDoorTile("door_blue")).toBe(true);
    expect(doorToKeyId("door_blue")).toBe("key_blue");
    expect(isBlockedCell(level, 0, 0)).toBe(true);
    removeTileAt(level, 0, 0, "door_blue");
    expect(getCompositeTile(level, 0, 0)).toBe("empty");
    expect(isBlockedCell(level, 0, 0)).toBe(false);
  });

  it("getLowerTileUnderMonster returns preserved floor under a creature", () => {
    const level = cellLevel(["ball_pink_e"], ["block_toggle_open"]);
    expect(getLowerTileUnderMonster(level, 0, 0)).toBe("block_toggle_open");
    const empty = cellLevel(["empty"], ["block_toggle_open"]);
    expect(getLowerTileUnderMonster(empty, 0, 0)).toBeNull();
  });

  it("socket blocks until all map chips are collected", () => {
    const level = cellLevel(["socket"], ["empty"]);
    expect(isBlockedCell(level, 0, 0, { chipsRemainingOnMap: 3 })).toBe(true);
    expect(isBlockedCell(level, 0, 0, { chipsRemainingOnMap: 0 })).toBe(false);
    removeTileAt(level, 0, 0, "socket");
    expect(getCompositeTile(level, 0, 0)).toBe("empty");
  });

  it("recessed wall blocks actors but not Chip when allowed", () => {
    const level = cellLevel(["wall_appearing"], ["empty"]);
    expect(isBlockedCell(level, 0, 0)).toBe(true);
    expect(isBlockedCell(level, 0, 0, { allowAppearingWall: true })).toBe(false);
    const passOnce = cellLevel(["hint_tile"], ["empty"]);
    expect(isBlockedCell(passOnce, 0, 0, { allowAppearingWall: true })).toBe(false);
  });
});
