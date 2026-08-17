import type { Direction, LevelData } from "../types.js";
import { chipsLeftAtLevelStart } from "../countCollectibles.js";
import {
  applyButtonPressAt,
  collectRedButtonCells,
  type MsCc1ButtonPressContext,
} from "./msCc1Buttons.js";
import {
  createMsCc1Monsters,
  tickMsCc1Monsters,
  type MsCc1MonsterState,
} from "./msCc1Monsters.js";
import {
  msCc1StateFromRun,
  tryMsCc1Move,
  type MsCc1MoveResult,
} from "./msCc1Movement.js";
import {
  getForceFloorIntentAt,
  getForceFloorTileAt,
  getTerrainTileUnderChip,
  slideDirectionAfterLanding,
} from "./msCc1Sliding.js";
import { directionFromMoveIntent } from "../moveIntent.js";
import { getCompositeTile } from "../levelRuntime.js";

import type { MsCc1PlayerState } from "./types.js";

export interface MsCc1SimulationRunner {
  level: LevelData;
  gx: number;
  gy: number;
  playerState: MsCc1PlayerState;
  monsters: MsCc1MonsterState[];
  buttonPressCtx: MsCc1ButtonPressContext;
  chipMoves: number;
  completed: boolean;
  playerDied: boolean;
  deathMessage?: string;
  /** Last successful step direction (ice continuation). */
  slideDir: Direction | null;
}

export interface MsCc1SimulationResult {
  completed: boolean;
  playerDied: boolean;
  deathMessage?: string;
  /** Voluntary direction inputs applied (excludes force-floor continuations). */
  chipMoves: number;
  finalPosition: { x: number; y: number };
  finalPlayerState: MsCc1PlayerState;
  /** Fingerprint of map layers after the run (for BFS dedup). */
  levelDigest: string;
}

function digestLevel(level: LevelData): string {
  return `${level.layers.upper.join(",")}|${level.layers.lower.join(",")}`;
}

function cloneButtonCtx(ctx: MsCc1ButtonPressContext): MsCc1ButtonPressContext {
  return {
    redButtonArmed: new Set(ctx.redButtonArmed),
    openTraps: new Set(ctx.openTraps),
    stuckOnTraps: new Set(ctx.stuckOnTraps),
    heldBrownButtons: new Set(ctx.heldBrownButtons),
    moveBoundary: ctx.moveBoundary,
    stepParity: ctx.stepParity,
    chipIgnoresTeeth: ctx.chipIgnoresTeeth,
  };
}

function cloneRunner(runner: MsCc1SimulationRunner): MsCc1SimulationRunner {
  return {
    level: structuredClone(runner.level),
    gx: runner.gx,
    gy: runner.gy,
    playerState: {
      keys: [...runner.playerState.keys],
      tools: [...runner.playerState.tools],
      chipsRemainingOnMap: runner.playerState.chipsRemainingOnMap,
    },
    monsters: runner.monsters.map((m) => ({ ...m })),
    buttonPressCtx: cloneButtonCtx(runner.buttonPressCtx),
    chipMoves: runner.chipMoves,
    completed: runner.completed,
    playerDied: runner.playerDied,
    deathMessage: runner.deathMessage,
    slideDir: runner.slideDir,
  };
}

/** BFS / search dedup key including monsters and trap state. */
export function msCc1RunnerStateKey(runner: MsCc1SimulationRunner): string {
  const monsters = runner.monsters
    .map((m) => `${m.alive ? 1 : 0}:${m.x},${m.y},${m.direction}`)
    .join(";");
  const openTraps = [...runner.buttonPressCtx.openTraps].sort().join(";");
  const stuckTraps = [...runner.buttonPressCtx.stuckOnTraps].sort().join(";");
  const brown = [...runner.buttonPressCtx.heldBrownButtons].sort().join(";");
  return [
    runner.gx,
    runner.gy,
    runner.playerState.chipsRemainingOnMap,
    runner.playerState.keys.join("+"),
    runner.playerState.tools.join("+"),
    digestLevel(runner.level),
    monsters,
    openTraps,
    stuckTraps,
    brown,
    runner.buttonPressCtx.moveBoundary,
    runner.buttonPressCtx.stepParity ?? "",
  ].join("|");
}

export function createMsCc1SimulationRunner(level: LevelData): MsCc1SimulationRunner {
  const working = structuredClone(level);
  const chipsLeft = chipsLeftAtLevelStart(working);
  return {
    level: working,
    gx: working.playerStart?.x ?? 0,
    gy: working.playerStart?.y ?? 0,
    playerState: msCc1StateFromRun([], chipsLeft, []),
    monsters: createMsCc1Monsters(working),
    buttonPressCtx: {
      redButtonArmed: collectRedButtonCells(working),
      openTraps: new Set(),
      stuckOnTraps: new Set(),
      heldBrownButtons: new Set(),
      moveBoundary: 0,
      stepParity: "even",
    },
    chipMoves: 0,
    completed: false,
    playerDied: false,
    slideDir: null,
  };
}

function applyPostMoveEffects(
  level: LevelData,
  monsters: MsCc1MonsterState[],
  buttonPressCtx: MsCc1ButtonPressContext,
  result: MsCc1MoveResult,
): boolean {
  for (const step of result.steps) {
    if (step.moved) {
      applyButtonPressAt(
        level,
        step.from,
        step.to,
        monsters,
        result.cellChanges,
        buttonPressCtx,
      );
    }
  }
  const tick = tickMsCc1Monsters(
    level,
    monsters,
    { x: result.position.x, y: result.position.y },
    result.state.chipsRemainingOnMap,
    (from, to, cellChanges) => {
      applyButtonPressAt(level, from, to, monsters, cellChanges, buttonPressCtx);
    },
    buttonPressCtx,
  );
  return tick.chipDied;
}

function continueForceFloorMoves(
  level: LevelData,
  position: { x: number; y: number },
  playerState: ReturnType<typeof msCc1StateFromRun>,
  monsters: MsCc1MonsterState[],
  buttonPressCtx: MsCc1ButtonPressContext,
): { result: MsCc1MoveResult; chipDied: boolean } | null {
  const intent = getForceFloorIntentAt(level, position.x, position.y, playerState);
  if (!intent) {
    return null;
  }
  const autoDir = directionFromMoveIntent(intent);
  const result = tryMsCc1Move(
    level,
    position,
    autoDir,
    playerState,
    buttonPressCtx,
    monsters,
  );
  if (!result.moved) {
    return null;
  }
  const chipDied = applyPostMoveEffects(level, monsters, buttonPressCtx, result);
  return { result, chipDied };
}

function rememberSlideDir(runner: MsCc1SimulationRunner, entryDir: Direction): void {
  const force = getForceFloorTileAt(runner.level, runner.gx, runner.gy);
  const tile =
    force ??
    getTerrainTileUnderChip(runner.level, runner.gx, runner.gy) ??
    getCompositeTile(runner.level, runner.gx, runner.gy);
  runner.slideDir = slideDirectionAfterLanding(tile, runner.playerState, entryDir);
}

function runOneChipMove(
  runner: MsCc1SimulationRunner,
  direction: Direction,
  options?: { chainSlides?: boolean },
): boolean {
  const chainSlides = options?.chainSlides !== false;
  const result = tryMsCc1Move(
    runner.level,
    { x: runner.gx, y: runner.gy },
    direction,
    runner.playerState,
    runner.buttonPressCtx,
    runner.monsters,
    { maxSlideSteps: chainSlides ? undefined : 0 },
  );
  if (!result.moved) {
    return false;
  }
  runner.gx = result.position.x;
  runner.gy = result.position.y;
  runner.playerState = result.state;
  rememberSlideDir(runner, result.direction);
  if (result.playerDied) {
    runner.playerDied = true;
    runner.deathMessage = result.deathMessage;
    return true;
  }
  if (result.completedLevel) {
    runner.completed = true;
    return true;
  }
  if (applyPostMoveEffects(runner.level, runner.monsters, runner.buttonPressCtx, result)) {
    runner.playerDied = true;
    runner.deathMessage = "Ooops! Look out for creatures!";
    return true;
  }
  if (!chainSlides) {
    return false;
  }
  let forceSteps = 0;
  const forceLimit = runner.level.width * runner.level.height;
  for (;;) {
    if (forceSteps >= forceLimit) {
      break;
    }
    const cont = continueForceFloorMoves(
      runner.level,
      { x: runner.gx, y: runner.gy },
      runner.playerState,
      runner.monsters,
      runner.buttonPressCtx,
    );
    if (!cont) {
      break;
    }
    runner.gx = cont.result.position.x;
    runner.gy = cont.result.position.y;
    runner.playerState = cont.result.state;
    rememberSlideDir(runner, cont.result.direction);
    if (cont.result.playerDied) {
      runner.playerDied = true;
      runner.deathMessage = cont.result.deathMessage;
      return true;
    }
    if (cont.result.completedLevel) {
      runner.completed = true;
      return true;
    }
    if (cont.chipDied) {
      runner.playerDied = true;
      runner.deathMessage = "Ooops! Look out for creatures!";
      return true;
    }
    forceSteps += 1;
  }
  return false;
}

/** Apply one voluntary chip direction; returns true when the run ends. */
export function stepMsCc1Simulation(
  runner: MsCc1SimulationRunner,
  direction: Direction,
  options?: { chainSlides?: boolean },
): boolean {
  if (runner.completed || runner.playerDied) {
    return true;
  }
  runner.chipMoves += 1;
  return runOneChipMove(runner, direction, options);
}

/**
 * One ice/force cell if Chip is sliding; otherwise no-op.
 * Returns true when a slide step was applied (or the run already ended),
 * so TWS gap ticks do not also idle-wait on the same tick.
 */
export function stepMsCc1SlideOnce(runner: MsCc1SimulationRunner): boolean {
  if (runner.completed || runner.playerDied) {
    return true;
  }
  const force = getForceFloorIntentAt(
    runner.level,
    runner.gx,
    runner.gy,
    runner.playerState,
  );
  const dir = force ? directionFromMoveIntent(force) : runner.slideDir;
  if (!dir) {
    return false;
  }
  const x = runner.gx;
  const y = runner.gy;
  const ended = runOneChipMove(runner, dir, { chainSlides: false });
  if (ended) {
    return true;
  }
  return runner.gx !== x || runner.gy !== y;
}

/** Idle monster clock tick (Chip holds position). */
export function stepMsCc1Wait(runner: MsCc1SimulationRunner): boolean {
  if (runner.completed || runner.playerDied) {
    return true;
  }
  // Idle / autoplay waits tick monsters but do NOT advance moveBoundary —
  // same as PlayScene.onMonsterMoveClockTick → tickMonstersAfterChip(false).
  // Chip moves advance the boundary via applyPostMoveEffects.
  const tick = tickMsCc1Monsters(
    runner.level,
    runner.monsters,
    { x: runner.gx, y: runner.gy },
    runner.playerState.chipsRemainingOnMap,
    (from, to, cellChanges) => {
      applyButtonPressAt(
        runner.level,
        from,
        to,
        runner.monsters,
        cellChanges,
        runner.buttonPressCtx,
      );
    },
    runner.buttonPressCtx,
    { advanceTeethBoundary: false },
  );
  if (tick.chipDied) {
    runner.playerDied = true;
    runner.deathMessage = "Ooops! Look out for creatures!";
    return true;
  }
  return false;
}

export function runnerToResult(runner: MsCc1SimulationRunner): MsCc1SimulationResult {
  return {
    completed: runner.completed,
    playerDied: runner.playerDied,
    deathMessage: runner.deathMessage,
    chipMoves: runner.chipMoves,
    finalPosition: { x: runner.gx, y: runner.gy },
    finalPlayerState: runner.playerState,
    levelDigest: digestLevel(runner.level),
  };
}

export { cloneRunner as cloneMsCc1SimulationRunner };

/**
 * Headless MS CC1 run: applies each direction like PlayScene (including force-floor
 * chains and monster ticks after each chip move).
 */
export function simulateMsCc1Level(
  level: LevelData,
  moves: Direction[],
): MsCc1SimulationResult {
  const runner = createMsCc1SimulationRunner(level);
  for (const direction of moves) {
    if (stepMsCc1Simulation(runner, direction)) {
      break;
    }
  }
  return runnerToResult(runner);
}

/**
 * Replay like web auto-play: one idle monster tick between each chip input
 * (matches MS_MOVE_INTERVAL_MS gap while Chip walks).
 */
export function simulateMsCc1AutoplayLevel(
  level: LevelData,
  moves: Direction[],
): MsCc1SimulationResult {
  const runner = createMsCc1SimulationRunner(level);
  for (const direction of moves) {
    if (runner.completed || runner.playerDied) {
      break;
    }
    stepMsCc1Wait(runner);
    if (runner.playerDied) {
      break;
    }
    if (stepMsCc1Simulation(runner, direction)) {
      break;
    }
  }
  return runnerToResult(runner);
}
