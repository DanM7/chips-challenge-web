import { directionFromMoveIntent } from "../../engine/moveIntent.js";
import {
  getForceFloorIntentAt,
  getForceFloorTileAt,
} from "../../engine/msCc1/msCc1Sliding.js";
import {
  msCc1StateFromRun,
  tryMsCc1Move,
} from "../../engine/msCc1/msCc1Movement.js";
import type { MsCc1PlayerState } from "../../engine/msCc1/types.js";
import type { Direction, LevelData } from "../../engine/types.js";
import { ChipMoveQueue } from "../../engine/chipMoveQueue.js";

export interface SimPosition {
  x: number;
  y: number;
}

export interface PlaySceneMoveTrace {
  positions: SimPosition[];
  final: SimPosition;
  state: MsCc1PlayerState;
}

/** Topmost force_s in level 9's west green-arrow staircase. */
export function level9ForceStairStart(level: LevelData): SimPosition {
  const south: SimPosition[] = [];
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (getForceFloorTileAt(level, x, y) === "force_s") {
        south.push({ x, y });
      }
    }
  }
  const start = south.sort((a, b) => a.y - b.y || a.x - b.x)[0];
  if (!start) {
    throw new Error("level 9 force_s staircase not found");
  }
  return start;
}

function continueForceFloorSlide(
  level: LevelData,
  position: SimPosition,
  state: MsCc1PlayerState,
  held: Direction | null,
): SimPosition {
  let pos = { ...position };
  let playerState = state;

  for (let guard = 0; guard < 64; guard += 1) {
    const forceIntent = getForceFloorIntentAt(level, pos.x, pos.y, playerState);
    if (!forceIntent) {
      return pos;
    }
    const before = { ...pos };
    const direction = held ?? directionFromMoveIntent(forceIntent);
    const result = tryMsCc1Move(level, pos, direction, playerState);
    if (!result.moved) {
      return pos;
    }
    pos = result.position;
    playerState = result.state;
    if (pos.x === before.x && pos.y === before.y) {
      return pos;
    }
  }

  return pos;
}

/** One PlayScene-style step: tryMsCc1Move + continueForceFloorSlide only while on a pad. */
export function playSceneStyleMove(
  level: LevelData,
  position: SimPosition,
  direction: Direction,
  state: MsCc1PlayerState,
  heldDuringContinue: Direction | null,
): { position: SimPosition; state: MsCc1PlayerState; moved: boolean } {
  const result = tryMsCc1Move(level, position, direction, state);
  if (!result.moved) {
    return { position, state, moved: false };
  }

  let pos = result.position;
  let playerState = result.state;
  if (getForceFloorIntentAt(level, pos.x, pos.y, playerState)) {
    pos = continueForceFloorSlide(level, pos, playerState, heldDuringContinue);
  }

  return {
    position: pos,
    state: playerState,
    moved: true,
  };
}

/** Old PlayScene: every repeat tick appends a full move (causes force-pad ping-pong). */
export function simulateFloodedDirectionInput(
  level: LevelData,
  start: SimPosition,
  direction: Direction,
  repeatCount: number,
): PlaySceneMoveTrace {
  const lvl = structuredClone(level);
  let pos = { ...start };
  let state = msCc1StateFromRun([], 0);
  const positions: SimPosition[] = [{ ...pos }];

  for (let i = 0; i < repeatCount; i += 1) {
    const step = playSceneStyleMove(lvl, pos, direction, state, direction);
    if (step.moved) {
      pos = step.position;
      state = step.state;
    }
    positions.push({ ...pos });
  }

  return { positions, final: pos, state };
}

/** Single tap: one move; force continuation uses no held input. */
export function simulateSingleTap(
  level: LevelData,
  start: SimPosition,
  direction: Direction,
): PlaySceneMoveTrace {
  const lvl = structuredClone(level);
  const state = msCc1StateFromRun([], 0);
  const step = playSceneStyleMove(lvl, start, direction, state, null);
  return {
    positions: [{ ...start }, { ...step.position }],
    final: step.position,
    state: step.state,
  };
}

/** Coalesced queue + flush on release (fixed PlayScene behaviour). */
export async function simulateCoalescedHoldWithRelease(
  level: LevelData,
  start: SimPosition,
  direction: Direction,
  repeatCount: number,
): Promise<PlaySceneMoveTrace> {
  const lvl = structuredClone(level);
  let pos = { ...start };
  let state = msCc1StateFromRun([], 0);
  const positions: SimPosition[] = [{ ...pos }];
  const queue = new ChipMoveQueue();
  let held: Direction | null = direction;

  const perform = async (dir: Direction): Promise<void> => {
    const result = tryMsCc1Move(lvl, pos, dir, state);
    if (!result.moved) {
      positions.push({ ...pos });
      return;
    }
    pos = result.position;
    state = result.state;
    // Key released before involuntary force continuation (PlayScene flush / key-up).
    held = null;
    if (getForceFloorIntentAt(lvl, pos.x, pos.y, state)) {
      pos = continueForceFloorSlide(lvl, pos, state, null);
    }
    positions.push({ ...pos });
  };

  for (let i = 0; i < repeatCount; i += 1) {
    queue.enqueue(direction, perform);
    await Promise.resolve();
  }

  held = null;
  queue.flush();
  await Promise.resolve();

  return { positions, final: pos, state };
}

export function countPositionRevisits(positions: SimPosition[]): number {
  const seen = new Map<string, number>();
  let repeats = 0;
  for (const pos of positions) {
    const key = `${pos.x},${pos.y}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count > 1) {
      repeats += 1;
    }
  }
  return repeats;
}

export function isOnForceSouth(level: LevelData, pos: SimPosition): boolean {
  return getForceFloorTileAt(level, pos.x, pos.y) === "force_s";
}
