import type { Direction } from "../types.js";

export interface MsCc1PlayerState {
  keys: string[];
  tools: string[];
  chipsRemainingOnMap: number;
}

export interface MsCc1CellChange {
  x: number;
  y: number;
  removedTileId?: string;
  placedTileId?: string;
}

/** One grid cell transition (voluntary step or slide continuation). */
export interface MsCc1MoveStep {
  from: { x: number; y: number };
  to: { x: number; y: number };
  moved: boolean;
  direction: Direction;
  state: MsCc1PlayerState;
  cellChanges: MsCc1CellChange[];
  completedLevel: boolean;
  playerDied?: boolean;
  deathMessage?: string;
}

export interface MsCc1MoveResult {
  moved: boolean;
  position: { x: number; y: number };
  state: MsCc1PlayerState;
  cellChanges: MsCc1CellChange[];
  /** Stepped onto the exit with all map chips collected (MS level complete). */
  completedLevel: boolean;
  direction: Direction;
  /** Per-tile steps for animation (empty when blocked). */
  steps: MsCc1MoveStep[];
  /** Chip died on this step (e.g. water without flippers); level should restart. */
  playerDied?: boolean;
  /** MS death message when `playerDied` is true. */
  deathMessage?: string;
}
