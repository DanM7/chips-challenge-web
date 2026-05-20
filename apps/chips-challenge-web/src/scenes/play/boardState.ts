import type Phaser from "phaser";
import type { LevelData } from "@engine/types";
import type { MsCc1MonsterState } from "@engine/msCc1/msCc1Monsters";

/** Mutable board presentation state owned by PlayScene, read by PlayBoardPresenter. */
export interface PlayBoardView {
  level: LevelData | null;
  monsters: MsCc1MonsterState[];
  frameByTileId: Map<string, number>;
  boardOriginX: number;
  boardOriginY: number;
  playerGx: number;
  playerGy: number;
  tileLayer?: Phaser.GameObjects.Container;
  chip?: Phaser.GameObjects.Sprite;
  cellSprites: Map<string, Phaser.GameObjects.Sprite>;
  cloneMachineFloorSprites: Map<string, Phaser.GameObjects.Sprite>;
  cloneMachineMidSprites: Map<string, Phaser.GameObjects.Sprite>;
  clonerOverlaySprites: Map<string, Phaser.GameObjects.Sprite>;
  monsterOverlaySprites: Map<string, Phaser.GameObjects.Sprite>;
  chipCompositeTextureKeys: Set<string>;
}

export function createPlayBoardView(): PlayBoardView {
  return {
    level: null,
    monsters: [],
    frameByTileId: new Map(),
    boardOriginX: 0,
    boardOriginY: 0,
    playerGx: 0,
    playerGy: 0,
    cellSprites: new Map(),
    cloneMachineFloorSprites: new Map(),
    cloneMachineMidSprites: new Map(),
    clonerOverlaySprites: new Map(),
    monsterOverlaySprites: new Map(),
    chipCompositeTextureKeys: new Set(),
  };
}
