import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { cellTile, getCompositeTile } from "../engine/levelRuntime.js";
import type { LevelData } from "../engine/types.js";
import {
  createMsCc1Monsters,
  tickMsCc1Monsters,
} from "../engine/msCc1/msCc1Monsters.js";
import { applyButtonPressAt } from "../engine/msCc1/msCc1Buttons.js";
import { isCreatureStuckOnTrap } from "../engine/msCc1/msCc1Traps.js";

import { fileURLToPath } from "node:url";
import path from "node:path";

const LEVEL_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
);

function loadLevel005(): LevelData {
  const level = JSON.parse(readFileSync(LEVEL_PATH, "utf8")) as LevelData;
  normalizeLevelLayers(level);
  return level;
}

function emptyButtonCtx() {
  return {
    redButtonArmed: new Set<string>(),
    openTraps: new Set<string>(),
    stuckOnTraps: new Set<string>(),
    heldBrownButtons: new Set<string>(),
    moveBoundary: 0,
  };
}

describe("level-005 glider (MS Lesson 5)", () => {
  it("keeps glider at DAT start (18,11), not teleported onto the brown button", () => {
    const level = loadLevel005();
    const monsters = createMsCc1Monsters(level);
    const glider = monsters.find((m) => m.alive && m.kind === "ghost");
    expect(glider, "ghost monster").toBeDefined();
    expect(glider!.x).toBe(18);
    expect(glider!.y).toBe(11);
    expect(cellTile(level, "upper", 18, 11)).toMatch(/^ghost_/);
    expect(getCompositeTile(level, 16, 7)).toBe("button_brown");
  });

  it("glider walks north onto the first trap and sticks until the brown button opens it", () => {
    const level = loadLevel005();
    const monsters = createMsCc1Monsters(level);
    const ctx = emptyButtonCtx();
    const glider = monsters.find((m) => m.alive && m.kind === "ghost")!;

    tickMsCc1Monsters(
      level,
      monsters,
      { x: 20, y: 19 },
      0,
      (from, to, changes) => applyButtonPressAt(level, from, to, monsters, changes, ctx),
      ctx,
    );

    expect(glider.x).toBe(18);
    expect(glider.y).toBe(10);
    expect(isCreatureStuckOnTrap(ctx, 18, 10)).toBe(true);

    applyButtonPressAt(
      level,
      { x: 16, y: 9 },
      { x: 16, y: 10 },
      monsters,
      [],
      ctx,
    );
    expect(ctx.openTraps.has("18,10")).toBe(true);
    expect(isCreatureStuckOnTrap(ctx, 18, 10)).toBe(false);

    tickMsCc1Monsters(
      level,
      monsters,
      { x: 20, y: 19 },
      0,
      (from, to, changes) => applyButtonPressAt(level, from, to, monsters, changes, ctx),
      ctx,
    );

    expect(glider.alive).toBe(true);
    expect(glider.y).toBeLessThan(10);
  });
});
