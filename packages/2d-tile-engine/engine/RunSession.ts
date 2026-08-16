import Phaser from "phaser";
import type { RunState } from "./types.js";
import { KEY_TILE_IDS, TOOL_TILE_IDS } from "../tile-engine/tiles.js";

export type KeyTileId = "key_blue" | "key_red" | "key_green" | "key_yellow";

export interface RunSessionConfig {
  levelNumber: number;
  /** Countdown start; `null` = no play clock (HUD shows dashes). */
  playClockInitialSeconds: number | null;
  collectiblesInitialCount: number;
}

/**
 * Generic per-level run counters (ruleset-agnostic).
 * Drives HUD via `run-state` events on the Phaser game bus.
 */
export class RunSession {
  private readonly config: RunSessionConfig;
  private readonly emit: (state: RunState) => void;
  private playClockSeconds: number | null;
  private collectiblesLeftCount: number;
  private readonly keysHeld: KeyTileId[] = [];
  private readonly toolsHeld: string[] = [];
  private clockTimer: Phaser.Time.TimerEvent | null = null;
  private playClockStarted = false;

  constructor(config: RunSessionConfig, emit: (state: RunState) => void) {
    this.config = config;
    this.emit = emit;
    this.playClockSeconds = config.playClockInitialSeconds;
    this.collectiblesLeftCount = config.collectiblesInitialCount;
  }

  getState(): RunState {
    return {
      levelNumber: this.config.levelNumber,
      playClockSeconds: this.playClockSeconds,
      collectiblesLeftCount: this.collectiblesLeftCount,
      inventory: { keys: [...this.keysHeld], tools: [...this.toolsHeld] },
    };
  }

  hasKey(keyId: string): boolean {
    return this.keysHeld.includes(keyId as KeyTileId);
  }

  /** Pick up a key. MS: colored keys stack; green is infinite (one copy). */
  tryAddKey(keyId: string): boolean {
    if (!KEY_TILE_IDS.has(keyId)) {
      return false;
    }
    const id = keyId as KeyTileId;
    if (id === "key_green") {
      if (!this.keysHeld.includes(id)) {
        this.keysHeld.push(id);
        this.emitState();
      }
      return true;
    }
    this.keysHeld.push(id);
    this.emitState();
    return true;
  }

  /** Spend a held key (e.g. opening a matching door). */
  consumeKey(keyId: string): boolean {
    const id = keyId as KeyTileId;
    const index = this.keysHeld.indexOf(id);
    if (index < 0) {
      return false;
    }
    this.keysHeld.splice(index, 1);
    this.emitState();
    return true;
  }

  /** Emit initial HUD state after level load; clock waits for {@link startPlayClock}. */
  start(scene: Phaser.Scene): void {
    this.stop();
    void scene;
    this.emitState();
  }

  /** MS: TIME counter begins on the player's first move. */
  startPlayClock(scene: Phaser.Scene): void {
    if (this.playClockStarted) {
      return;
    }
    this.playClockStarted = true;

    if (this.playClockSeconds == null || this.playClockSeconds <= 0) {
      return;
    }

    this.clockTimer = scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.playClockSeconds == null || this.playClockSeconds <= 0) {
          this.stopClock();
          return;
        }
        this.playClockSeconds -= 1;
        this.emitState();
        if (this.playClockSeconds <= 0) {
          this.stopClock();
        }
      },
    });
  }

  /** Sync inventory and chip counter after an MS CC1 rules step. */
  applyMsCc1State(state: {
    keys: string[];
    tools: string[];
    chipsRemainingOnMap: number;
  }): void {
    this.keysHeld.length = 0;
    for (const key of state.keys) {
      if (KEY_TILE_IDS.has(key)) {
        this.keysHeld.push(key as KeyTileId);
      }
    }
    this.toolsHeld.length = 0;
    for (const tool of state.tools) {
      if (TOOL_TILE_IDS.has(tool)) {
        this.toolsHeld.push(tool);
      }
    }
    this.collectiblesLeftCount = state.chipsRemainingOnMap;
    this.emitState();
  }

  /** Player picked up one collectible still on the map. */
  collectOne(): boolean {
    if (this.collectiblesLeftCount <= 0) {
      return false;
    }
    this.collectiblesLeftCount -= 1;
    this.emitState();
    return true;
  }

  stop(): void {
    this.playClockStarted = false;
    this.stopClock();
  }

  private stopClock(): void {
    if (this.clockTimer) {
      this.clockTimer.destroy();
      this.clockTimer = null;
    }
  }

  private emitState(): void {
    this.emit(this.getState());
  }
}
