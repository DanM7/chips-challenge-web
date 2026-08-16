import Phaser from "phaser";
import type { GameManifest } from "./types";
import type { GameEventBus } from "./GameEventBus";

export type SceneConstructor = new (...args: unknown[]) => Phaser.Scene;

export interface GameEngineOptions {
  parentId: string;
  /** Map manifest `initialScene` keys to Phaser scene classes. */
  sceneMap: Record<string, SceneConstructor>;
}

function mergePhaserConfig(
  base: Phaser.Types.Core.GameConfig,
  manifest: GameManifest,
): Phaser.Types.Core.GameConfig {
  const extra = manifest.phaser;
  if (!extra) return base;

  const merged: Phaser.Types.Core.GameConfig = {
    ...base,
    ...extra,
  };

  if (extra.scale) {
    merged.scale = {
      ...base.scale,
      ...extra.scale,
    } as Phaser.Types.Core.GameConfig["scale"];
  }

  return merged;
}

/**
 * Boots Phaser from a loaded `GameManifest` so each title can ship its own JSON.
 */
export class GameEngine {
  private game: Phaser.Game | null = null;

  start(
    manifest: GameManifest,
    bus: GameEventBus,
    options: GameEngineOptions,
  ): Phaser.Game {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }

    const SceneClass = options.sceneMap[manifest.initialScene];
    if (!SceneClass) {
      throw new Error(`Unknown initialScene "${manifest.initialScene}" in sceneMap`);
    }

    const baseConfig: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: options.parentId,
      backgroundColor: "#0f0f1a",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 511,
        height: 351,
      },
      roundPixels: true,
      render: {
        antialias: false,
        pixelArt: true,
      },
      scene: SceneClass,
    };

    const config = mergePhaserConfig(baseConfig, manifest);

    this.game = new Phaser.Game(config);
    this.game.registry.set("manifest", manifest);
    this.game.registry.set("eventBus", bus);

    return this.game;
  }

  destroy(): void {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }
}
