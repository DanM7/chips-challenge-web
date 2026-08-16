import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { getForceFloorTileAt } from "../engine/msCc1/msCc1Sliding.js";
import { tryMsCc1Move, msCc1StateFromRun } from "../engine/msCc1/msCc1Movement.js";
import type { LevelData } from "../engine/types.js";
import {
  countPositionRevisits,
  isOnForceSouth,
  level9ForceStairStart,
  simulateCoalescedHoldWithRelease,
  simulateFloodedDirectionInput,
  simulateSingleTap,
} from "./helpers/playSceneForceMoveSimulation.js";

const level009Path = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
);

function loadLevel009(): LevelData {
  const raw = JSON.parse(readFileSync(level009Path, "utf8")) as LevelData;
  normalizeLevelLayers(raw);
  return raw;
}

describe("level 9 force staircase input (PlayScene model)", () => {
  const level = loadLevel009();
  const start = level9ForceStairStart(level);

  it("uses level 9 west force_s column entry", () => {
    expect(getForceFloorTileAt(level, start.x, start.y)).toBe("force_s");
  });

  it("single right tap exits the force strip", () => {
    const trace = simulateSingleTap(level, start, "right");

    expect(trace.final.y).toBeGreaterThan(start.y);
    expect(isOnForceSouth(level, trace.final)).toBe(false);
  });

  it("flooded right repeats ping-pong on force pads (old input queue bug)", () => {
    const single = simulateSingleTap(level, start, "right");
    const flooded = simulateFloodedDirectionInput(level, start, "right", 12);

    expect(countPositionRevisits(flooded.positions)).toBeGreaterThan(2);
    expect(flooded.final).not.toEqual(single.final);
    expect(isOnForceSouth(level, flooded.final)).toBe(true);
  });

  it("coalesced hold with release leaves force strip and accepts other input", async () => {
    const coalesced = await simulateCoalescedHoldWithRelease(level, start, "right", 12);
    const flooded = simulateFloodedDirectionInput(level, start, "right", 12);

    expect(isOnForceSouth(level, coalesced.final)).toBe(false);
    expect(isOnForceSouth(level, flooded.final)).toBe(true);

    const lvl = structuredClone(level);
    const up = tryMsCc1Move(lvl, coalesced.final, "up", coalesced.state);
    const left = tryMsCc1Move(lvl, coalesced.final, "left", coalesced.state);
    expect(up.moved || left.moved).toBe(true);
  });
});
