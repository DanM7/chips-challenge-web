import Phaser from "phaser";
import {
  cellTile,
  getCompositeTile,
  getLowerTileUnderMonster,
  isCloneMachineAt,
} from "@engine/levelRuntime";
import { getTerrainTileUnderChip } from "@engine/msCc1/msCc1Sliding";
import type { MsCc1MonsterState } from "@engine/msCc1/msCc1Monsters";
import {
  compositeMsMaskedChipOnlyFromSheet,
  compositeMsMaskedFromSheet,
  MS_CHIP_WALK_OBJECT_CODE,
  msCreatureUsesMaskedSprite,
} from "@engine/msMaskedComposite";
import {
  CHIP_TILE_IDS,
  FLIPPERS_TILE_ID,
  isMonsterTile,
  objectCodeFromTileId,
} from "@tile-engine/tiles";
import { MS_TILE_SIZE } from "@tile-engine/msTileIndex";
import type { Direction } from "@engine/types";
import { CHIP_SWIM_FRAME, CHIP_WALK_FRAME, MS_TILES_KEY } from "./constants.js";
import type { PlayBoardView } from "./boardState.js";

/** Phaser sprites for the playfield grid, Chip, and creature overlays. */
export class PlayBoardPresenter {
  constructor(
    private readonly scene: Phaser.Scene,
    readonly view: PlayBoardView,
  ) {}

  clearSpriteLayers(): void {
    this.view.tileLayer?.destroy(true);
    this.view.tileLayer = undefined;
    this.view.chip?.destroy();
    this.view.chip = undefined;
    this.view.cellSprites.clear();
    this.view.cloneMachineFloorSprites.clear();
    this.view.cloneMachineMidSprites.clear();
    this.view.clonerOverlaySprites.clear();
    this.view.monsterOverlaySprites.clear();
    this.destroyChipCompositeTextures();
  }

  createTileLayer(): Phaser.GameObjects.Container {
    const layer = this.scene.add.container(0, 0).setDepth(10);
    this.view.tileLayer = layer;
    return layer;
  }

  createChipSprite(gx: number, gy: number, frame: number): Phaser.GameObjects.Sprite {
    const tile = MS_TILE_SIZE;
    const chip = this.scene.add
      .sprite(
        this.view.boardOriginX + (gx + 0.5) * tile,
        this.view.boardOriginY + (gy + 0.5) * tile,
        MS_TILES_KEY,
        frame,
      )
      .setOrigin(0.5)
      .setDepth(20);
    chip.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    chip.setBlendMode(Phaser.BlendModes.NORMAL);
    this.view.chip = chip;
    return chip;
  }

  hasFlippers(tools: string[] | undefined): boolean {
    return tools?.includes(FLIPPERS_TILE_ID) ?? false;
  }

  isSwimmingAt(x: number, y: number, tools: string[] | undefined): boolean {
    if (!this.view.level || !this.hasFlippers(tools)) return false;
    return getCompositeTile(this.view.level, x, y) === "water";
  }

  destroyChipCompositeTextures(): void {
    for (const key of this.view.chipCompositeTextureKeys) {
      this.scene.textures.remove(key);
    }
    this.view.chipCompositeTextureKeys.clear();
  }

  private uploadChipCanvasTexture(key: string, pixels: Uint8ClampedArray): string {
    if (this.scene.textures.exists(key)) {
      return key;
    }
    const tex = this.scene.textures.createCanvas(key, MS_TILE_SIZE, MS_TILE_SIZE);
    if (!tex) {
      return MS_TILES_KEY;
    }
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, MS_TILE_SIZE, MS_TILE_SIZE);
    const imageData = ctx.createImageData(MS_TILE_SIZE, MS_TILE_SIZE);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    tex.refresh();
    this.view.chipCompositeTextureKeys.add(key);
    return key;
  }

  ensureChipMaskedWalkTexture(walkObjectCode: number): string {
    const key = `chip_mask_${walkObjectCode}`;
    if (this.scene.textures.exists(key)) {
      return key;
    }
    const source = this.scene.textures
      .get(MS_TILES_KEY)
      .getSourceImage() as CanvasImageSource;
    const pixels = compositeMsMaskedChipOnlyFromSheet(source, walkObjectCode);
    return this.uploadChipCanvasTexture(key, pixels);
  }

  ensureCreatureMaskedPreviewTexture(objectCode: number): string {
    const key = `creature_mask_${objectCode.toString(16)}`;
    if (this.scene.textures.exists(key)) {
      return key;
    }
    const source = this.scene.textures
      .get(MS_TILES_KEY)
      .getSourceImage() as CanvasImageSource;
    const pixels = compositeMsMaskedChipOnlyFromSheet(source, objectCode);
    return this.uploadChipCanvasTexture(key, pixels);
  }

  ensureCreatureMaskedFloorTexture(floorTileId: string, creatureObjectCode: number): string {
    const key = `creature_${floorTileId}_${creatureObjectCode.toString(16)}`;
    if (this.scene.textures.exists(key)) {
      return key;
    }
    const source = this.scene.textures
      .get(MS_TILES_KEY)
      .getSourceImage() as CanvasImageSource;
    const floorFrame = this.view.frameByTileId.get(floorTileId) ?? 0;
    const pixels = compositeMsMaskedFromSheet(source, floorFrame, creatureObjectCode);
    return this.uploadChipCanvasTexture(key, pixels);
  }

  placeCreatureCompositeOverlay(x: number, y: number, textureKey: string): void {
    if (!this.view.tileLayer) return;
    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.view.boardOriginX + x * tile;
    const py = this.view.boardOriginY + y * tile;
    let sprite = this.view.monsterOverlaySprites.get(key);
    if (!sprite) {
      sprite = this.scene.add.sprite(px + tile / 2, py + tile / 2, textureKey).setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.view.tileLayer.add(sprite);
      this.view.monsterOverlaySprites.set(key, sprite);
    } else {
      sprite.setTexture(textureKey);
      sprite.setVisible(true);
    }
    this.view.tileLayer.bringToTop(sprite);
    this.view.cellSprites.get(key)?.setVisible(false);
  }

  setChipFrameForDirection(
    direction: Direction,
    state: { tools: string[] },
    atGx = this.view.playerGx,
    atGy = this.view.playerGy,
  ): void {
    const chip = this.view.chip;
    const level = this.view.level;
    if (!chip || !level) return;

    if (this.isSwimmingAt(atGx, atGy, state.tools)) {
      if (chip.texture.key !== MS_TILES_KEY) {
        chip.setTexture(MS_TILES_KEY);
      }
      const swimTile = CHIP_SWIM_FRAME[direction];
      const frame =
        this.view.frameByTileId.get(swimTile) ??
        this.view.frameByTileId.get("chip_swim_s") ??
        0;
      chip.setFrame(frame);
      return;
    }

    const terrainId = getTerrainTileUnderChip(level, atGx, atGy);
    if (terrainId) {
      const walkCode = MS_CHIP_WALK_OBJECT_CODE[direction];
      const texKey = this.ensureChipMaskedWalkTexture(walkCode);
      if (chip.texture.key !== texKey) {
        chip.setTexture(texKey);
      }
      return;
    }

    if (chip.texture.key !== MS_TILES_KEY) {
      chip.setTexture(MS_TILES_KEY);
    }
    const walkTile = CHIP_WALK_FRAME[direction];
    const frame =
      this.view.frameByTileId.get(walkTile) ?? this.view.frameByTileId.get("chip_s") ?? 0;
    chip.setFrame(frame);
  }

  refreshCellUnderChip(
    tools?: string[],
    atGx = this.view.playerGx,
    atGy = this.view.playerGy,
  ): void {
    if (!this.view.level) return;
    const key = `${atGx},${atGy}`;
    if (this.isSwimmingAt(atGx, atGy, tools)) {
      this.view.cellSprites.get(key)?.setVisible(false);
      return;
    }
    const tileId = getTerrainTileUnderChip(this.view.level, atGx, atGy);
    if (!tileId) return;
    this.refreshCellAt(atGx, atGy, tileId);
  }

  placeBoardSprite(x: number, y: number, tileId: string): void {
    if (!this.view.tileLayer) return;
    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.view.boardOriginX + x * tile;
    const py = this.view.boardOriginY + y * tile;
    const frame = this.view.frameByTileId.get(tileId) ?? this.view.frameByTileId.get("empty") ?? 0;
    let sprite = this.view.cellSprites.get(key);
    if (!sprite) {
      sprite = this.scene.add
        .sprite(px + tile / 2, py + tile / 2, MS_TILES_KEY, frame)
        .setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.view.tileLayer.add(sprite);
      this.view.cellSprites.set(key, sprite);
    } else {
      sprite.setVisible(true);
      sprite.setFrame(frame);
    }
  }

  private placeCloneMachineLayerSprite(
    x: number,
    y: number,
    tileId: string,
    store: Map<string, Phaser.GameObjects.Sprite>,
  ): void {
    if (!this.view.tileLayer) return;
    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.view.boardOriginX + x * tile;
    const py = this.view.boardOriginY + y * tile;
    const frame = this.view.frameByTileId.get(tileId) ?? this.view.frameByTileId.get("empty") ?? 0;
    let sprite = store.get(key);
    if (!sprite) {
      sprite = this.scene.add
        .sprite(px + tile / 2, py + tile / 2, MS_TILES_KEY, frame)
        .setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.view.tileLayer.add(sprite);
      store.set(key, sprite);
    } else {
      sprite.setVisible(true);
      sprite.setFrame(frame);
    }
  }

  hideCloneMachineSprites(x: number, y: number): void {
    const key = `${x},${y}`;
    this.view.cloneMachineFloorSprites.get(key)?.setVisible(false);
    this.view.cloneMachineMidSprites.get(key)?.setVisible(false);
    this.view.clonerOverlaySprites.get(key)?.setVisible(false);
  }

  placeRuntimeMonsterOverlay(x: number, y: number, tileId: string): void {
    if (!this.view.tileLayer) return;
    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.view.boardOriginX + x * tile;
    const py = this.view.boardOriginY + y * tile;
    const frame = this.view.frameByTileId.get(tileId) ?? 0;
    let sprite = this.view.monsterOverlaySprites.get(key);
    if (!sprite) {
      sprite = this.scene.add
        .sprite(px + tile / 2, py + tile / 2, MS_TILES_KEY, frame)
        .setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.view.tileLayer.add(sprite);
      this.view.monsterOverlaySprites.set(key, sprite);
    } else {
      sprite.setTexture(MS_TILES_KEY);
      sprite.setFrame(frame);
      sprite.setVisible(true);
    }
  }

  private placeMaskedCreatureOverlay(
    x: number,
    y: number,
    objectCode: number,
    store: Map<string, Phaser.GameObjects.Sprite>,
  ): void {
    if (!this.view.tileLayer) return;
    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.view.boardOriginX + x * tile;
    const py = this.view.boardOriginY + y * tile;
    const texKey = this.ensureCreatureMaskedPreviewTexture(objectCode);
    let sprite = store.get(key);
    if (!sprite) {
      sprite = this.scene.add.sprite(px + tile / 2, py + tile / 2, texKey).setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.view.tileLayer.add(sprite);
      store.set(key, sprite);
    } else {
      sprite.setTexture(texKey);
      sprite.setVisible(true);
    }
  }

  private hideMaskedCreatureOverlay(
    x: number,
    y: number,
    store: Map<string, Phaser.GameObjects.Sprite>,
  ): void {
    store.get(`${x},${y}`)?.setVisible(false);
  }

  placeCloneMachineCell(x: number, y: number): void {
    if (!this.view.level || !this.view.tileLayer) return;
    const key = `${x},${y}`;
    this.view.cellSprites.get(key)?.setVisible(false);
    this.placeCloneMachineLayerSprite(x, y, "empty", this.view.cloneMachineFloorSprites);
    this.placeCloneMachineLayerSprite(x, y, "cloner", this.view.cloneMachineMidSprites);
    const preview = cellTile(this.view.level, "upper", x, y);
    if (isMonsterTile(preview)) {
      const objectCode = objectCodeFromTileId(preview);
      if (objectCode != null) {
        this.placeMaskedCreatureOverlay(x, y, objectCode, this.view.clonerOverlaySprites);
      } else {
        this.view.clonerOverlaySprites.get(key)?.setVisible(false);
      }
    } else {
      this.view.clonerOverlaySprites.get(key)?.setVisible(false);
    }
  }

  refreshCloneMachineCell(x: number, y: number): void {
    this.placeCloneMachineCell(x, y);
  }

  findMonsterAt(x: number, y: number): MsCc1MonsterState | undefined {
    return this.view.monsters.find((m) => m.alive && m.x === x && m.y === y);
  }

  syncMonsterOverlays(): void {
    if (!this.view.level || !this.view.tileLayer) return;
    const occupied = new Set<string>();
    for (const monster of this.view.monsters) {
      if (!monster.alive) continue;
      occupied.add(`${monster.x},${monster.y}`);
      this.refreshCellAt(monster.x, monster.y);
    }
    for (const [key, sprite] of this.view.monsterOverlaySprites) {
      if (!occupied.has(key)) {
        sprite.setVisible(false);
      }
    }
  }

  refreshCellAt(x: number, y: number, tileIdOverride?: string): void {
    const level = this.view.level;
    if (!level || !this.view.tileLayer) return;

    if (isCloneMachineAt(level, x, y)) {
      this.refreshCloneMachineCell(x, y);
      return;
    }

    this.hideCloneMachineSprites(x, y);
    const occupant = this.findMonsterAt(x, y);
    if (occupant) {
      const lower = cellTile(level, "lower", x, y);
      const floorId = lower !== "empty" ? lower : "empty";
      this.hideMaskedCreatureOverlay(x, y, this.view.monsterOverlaySprites);
      const objectCode = objectCodeFromTileId(occupant.tileId);
      if (objectCode != null && msCreatureUsesMaskedSprite(objectCode)) {
        const texKey = this.ensureCreatureMaskedFloorTexture(floorId, objectCode);
        this.placeCreatureCompositeOverlay(x, y, texKey);
      } else {
        this.placeBoardSprite(x, y, floorId);
        this.placeRuntimeMonsterOverlay(x, y, occupant.tileId);
      }
      return;
    }

    const tileId = tileIdOverride ?? getCompositeTile(level, x, y);
    const key = `${x},${y}`;

    if (CHIP_TILE_IDS.has(tileId)) {
      this.view.cellSprites.get(key)?.setVisible(false);
      this.hideMaskedCreatureOverlay(x, y, this.view.monsterOverlaySprites);
      return;
    }

    const floorUnderMonster = getLowerTileUnderMonster(level, x, y);
    if (isMonsterTile(tileId) && floorUnderMonster) {
      const objectCode = objectCodeFromTileId(tileId);
      if (objectCode != null && msCreatureUsesMaskedSprite(objectCode)) {
        const texKey = this.ensureCreatureMaskedFloorTexture(
          floorUnderMonster,
          objectCode,
        );
        this.placeCreatureCompositeOverlay(x, y, texKey);
        return;
      }
    }

    this.hideMaskedCreatureOverlay(x, y, this.view.monsterOverlaySprites);
    this.placeBoardSprite(x, y, tileId);
  }

  paintStaticCells(): void {
    const level = this.view.level;
    if (!level || !this.view.tileLayer) return;
    const upper = level.layers.upper as string[];
    const hasLayers = upper.length > 0;
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (hasLayers && isCloneMachineAt(level, x, y)) {
          this.placeCloneMachineCell(x, y);
          continue;
        }
        const tileId = hasLayers ? getCompositeTile(level, x, y) : "empty";
        if (CHIP_TILE_IDS.has(tileId)) continue;
        this.refreshCellAt(x, y);
      }
    }
    this.syncMonsterOverlays();
  }
}
