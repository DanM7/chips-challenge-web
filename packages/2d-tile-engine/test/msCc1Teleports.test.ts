import { describe, expect, it } from "vitest";
import type { LevelData } from "../engine/types.js";
import {
  getCompositeTile,
} from "../engine/levelRuntime.js";
import {
  resolveBlueTeleport,
  resolveBlueTeleportForBlock,
  reverseWrappableNext,
} from "../engine/msCc1/msCc1Teleports.js";
import {
  msCc1StateFromRun,
  tryMsCc1Move,
} from "../engine/msCc1/msCc1Movement.js";

function levelFromGrid(
  cells: Record<string, string>,
  width = 10,
  height = 1,
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
  };
}

describe("reverseWrappableNext", () => {
  it("steps west within a row then north with wrap", () => {
    expect(reverseWrappableNext(3, 1, 10, 3)).toEqual({ x: 2, y: 1 });
    expect(reverseWrappableNext(0, 1, 10, 3)).toEqual({ x: 9, y: 0 });
    expect(reverseWrappableNext(0, 0, 10, 3)).toEqual({ x: 9, y: 2 });
  });
});

describe("resolveBlueTeleport", () => {
  it("warps to the exit face of the next pad in reverse reading order", () => {
    const level = levelFromGrid({
      "1,0": "chip_s",
      "3,0": "teleport",
      "6,0": "teleport",
      "7,0": "empty",
    });
    const state = msCc1StateFromRun([], 0);
    const r = resolveBlueTeleport(level, 3, 0, "right", state);
    expect(r).toEqual({ kind: "warp", x: 7, y: 0 });
  });

  it("skips a pad when its exit face is blocked", () => {
    const level = levelFromGrid({
      "3,0": "teleport",
      "5,0": "teleport",
      "6,0": "wall",
      "8,0": "teleport",
      "9,0": "empty",
    });
    const state = msCc1StateFromRun([], 0);
    const r = resolveBlueTeleport(level, 3, 0, "right", state);
    expect(r).toEqual({ kind: "warp", x: 9, y: 0 });
  });
});

describe("resolveBlueTeleportForBlock", () => {
  it("warps a block to the same exit face as Chip", () => {
    const level = levelFromGrid({
      "3,0": "teleport",
      "6,0": "teleport",
      "7,0": "empty",
    });
    const r = resolveBlueTeleportForBlock(level, 3, 0, "right", 0);
    expect(r).toEqual({ kind: "warp", x: 7, y: 0 });
  });
});

describe("tryMsCc1Move teleports", () => {
  it("teleports Chip through a pad chain", () => {
    const level = levelFromGrid({
      "2,0": "chip_s",
      "3,0": "teleport",
      "6,0": "teleport",
      "7,0": "empty",
    });
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(level, { x: 2, y: 0 }, "right", state);
    expect(r.moved).toBe(true);
    expect(r.position).toEqual({ x: 7, y: 0 });
    expect(r.steps.length).toBeGreaterThanOrEqual(2);
  });

  it("bounces Chip back when no exit and through is blocked", () => {
    const level = levelFromGrid({
      "1,0": "chip_s",
      "2,0": "teleport",
      "3,0": "wall",
    });
    const state = msCc1StateFromRun([], 0);
    const r = tryMsCc1Move(level, { x: 1, y: 0 }, "right", state);
    expect(r.moved).toBe(true);
    expect(r.position).toEqual({ x: 1, y: 0 });
  });

  it("teleports a pushed block then Chip can follow and push it again", () => {
    const level = levelFromGrid({
      "0,0": "chip_s",
      "1,0": "block_movable",
      "2,0": "teleport",
      "6,0": "teleport",
      "7,0": "empty",
      "8,0": "empty",
    });
    const state = msCc1StateFromRun([], 0);
    const push = tryMsCc1Move(level, { x: 0, y: 0 }, "right", state);
    expect(push.moved).toBe(true);
    expect(push.position).toEqual({ x: 1, y: 0 });
    expect(getCompositeTile(level, 2, 0)).toBe("teleport");
    expect(getCompositeTile(level, 7, 0)).toBe("block_movable");
    expect(getCompositeTile(level, 8, 0)).toBe("empty");

    const follow = tryMsCc1Move(level, { x: 1, y: 0 }, "right", state);
    expect(follow.moved).toBe(true);
    expect(follow.position).toEqual({ x: 7, y: 0 });
    expect(getCompositeTile(level, 8, 0)).toBe("block_movable");
    expect(getCompositeTile(level, 2, 0)).toBe("teleport");
  });
});
