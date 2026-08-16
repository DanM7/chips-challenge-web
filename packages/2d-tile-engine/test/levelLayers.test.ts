import { describe, expect, it } from "vitest";
import { compactLayer, expandLayer, normalizeLevelLayers } from "../engine/levelLayers.js";
import type { LevelData } from "../engine/types.js";

describe("levelLayers", () => {
  it("compactLayer strips leading empty cells", () => {
    expect(compactLayer(["empty", "empty", "wall", "floor"])).toEqual({
      emptyPrefix: 2,
      tiles: ["wall", "floor"],
    });
  });

  it("expandLayer restores leading empty cells", () => {
    const full = expandLayer({ emptyPrefix: 2, tiles: ["wall", "floor"] }, 4);
    expect(full).toEqual(["empty", "empty", "wall", "floor"]);
  });

  it("normalizeLevelLayers expands compact JSON layers", () => {
    const level: LevelData = {
      id: "t",
      name: "t",
      width: 2,
      height: 2,
      tileSize: 32,
      layers: {
        lower: { emptyPrefix: 4, tiles: [] },
        upper: { emptyPrefix: 1, tiles: ["wall", "chip_s"] },
      },
    };
    normalizeLevelLayers(level);
    expect(level.layers.lower).toEqual(["empty", "empty", "empty", "empty"]);
    expect(level.layers.upper).toEqual(["empty", "wall", "chip_s", "empty"]);
  });
});
