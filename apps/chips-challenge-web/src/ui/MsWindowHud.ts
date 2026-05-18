import Phaser from "phaser";
import type { LevelData, RunState } from "@engine/types.js";
import { MsSevenSegment } from "./MsSevenSegment.js";
import type { DigitsManifest } from "./msDigits.js";
import { ensureMsDigitTextures, loadDigitsManifest } from "./msDigits.js";
import { MS_TILE_SIZE } from "@tile-engine/msTileIndex.js";
import {
  MS_CHROME_FRAME,
  MS_WINDOW_TEXTURE,
  registerMsChromeFrame,
  type MsWindowLayout,
} from "./msWindowLayout.js";

const MS_TILES_KEY = "ms_tiles";

/**
 * MS play window chrome (circuit frame, 7-segment counters, inventory slots).
 * Rendered inside the Phaser canvas; see docs/ui-and-hud.md.
 */
export class MsWindowHud {
  private readonly scene: Phaser.Scene;
  private readonly layout: MsWindowLayout;
  private readonly frameByTileId: Map<string, number>;
  private digitsManifest: DigitsManifest | null = null;
  private root?: Phaser.GameObjects.Container;
  private levelDisplay?: MsSevenSegment;
  private timeDisplay?: MsSevenSegment;
  private chipsDisplay?: MsSevenSegment;
  /** Top row: keys fill left → right in the first empty slot. */
  private readonly topRowIcons: Phaser.GameObjects.Sprite[] = [];
  /** Bottom row: boots/tools (fixed slots). */
  private readonly toolIcons = new Map<string, Phaser.GameObjects.Sprite>();
  private staticLevelNumber: number | null = null;

  constructor(
    scene: Phaser.Scene,
    layout: MsWindowLayout,
    frameByTileId: Map<string, number>,
  ) {
    this.scene = scene;
    this.layout = layout;
    this.frameByTileId = frameByTileId;
  }

  async prepareDigits(): Promise<void> {
    const url =
      this.layout.digitsUrl ??
      "/games/chips-challenge-100/sprites/digits/digits.json";
    this.digitsManifest = await loadDigitsManifest(url);
    await ensureMsDigitTextures(this.scene, this.digitsManifest);
  }

  build(): void {
    if (!this.digitsManifest) {
      throw new Error("MsWindowHud.prepareDigits() must run before build()");
    }

    this.destroy();
    registerMsChromeFrame(this.scene.textures, this.layout);

    this.root = this.scene.add.container(0, 0).setDepth(5);

    const chrome = this.scene.add
      .image(0, 0, MS_WINDOW_TEXTURE, MS_CHROME_FRAME)
      .setOrigin(0, 0);
    chrome.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.root.add(chrome);

    const digits = this.digitsManifest;
    this.levelDisplay = new MsSevenSegment(this.scene, this.layout, digits, "level");
    this.timeDisplay = new MsSevenSegment(this.scene, this.layout, digits, "time");
    this.chipsDisplay = new MsSevenSegment(this.scene, this.layout, digits, "chips");
    this.scene.add.existing(this.levelDisplay);
    this.scene.add.existing(this.timeDisplay);
    this.scene.add.existing(this.chipsDisplay);

    this.buildInventorySlots();
  }

  private buildInventorySlots(): void {
    const inv = this.layout.inventory;
    const topRow = inv.slots
      .filter((slot) => slot.row === 0)
      .sort((a, b) => a.col - b.col);

    for (const slot of topRow) {
      const x =
        inv.origin.x + slot.col * inv.columnStep + inv.slotWidth / 2;
      const y =
        inv.origin.y + slot.row * inv.rowStep + inv.slotHeight / 2;

      this.topRowIcons.push(this.createInventoryIcon(x, y));
    }

    for (const slot of inv.slots) {
      if (slot.row !== 1) continue;

      const x =
        inv.origin.x + slot.col * inv.columnStep + inv.slotWidth / 2;
      const y =
        inv.origin.y + slot.row * inv.rowStep + inv.slotHeight / 2;

      this.toolIcons.set(
        slot.id,
        this.createInventoryIcon(x, y, this.frameByTileId.get(slot.tileId) ?? 0),
      );
    }
  }

  /** Native tile pixels (32×32); scaling down blurs MS art. */
  private createInventoryIcon(
    x: number,
    y: number,
    frame = 0,
  ): Phaser.GameObjects.Sprite {
    const icon = this.scene.add
      .sprite(x, y, MS_TILES_KEY, frame)
      .setOrigin(0.5)
      .setDisplaySize(MS_TILE_SIZE, MS_TILE_SIZE)
      .setVisible(false)
      .setDepth(25);
    icon.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return icon;
  }

  /** Level number is static for the run; clock and collectibles update via run state. */
  applyLevel(level: LevelData): void {
    const hud = level.hud;
    this.staticLevelNumber = hud?.levelNumber ?? parseLevelNumber(level.id);
    this.levelDisplay?.setValue(this.staticLevelNumber);
    this.clearInventory();
  }

  applyRunState(state: RunState): void {
    if (state.playClockSeconds == null) {
      this.timeDisplay?.setDigits("---");
    } else {
      this.timeDisplay?.setValue(state.playClockSeconds);
    }
    this.chipsDisplay?.setValue(state.collectiblesLeftCount);

    const keys = state.inventory?.keys ?? [];
    for (let i = 0; i < this.topRowIcons.length; i++) {
      const icon = this.topRowIcons[i]!;
      const keyId = keys[i];
      if (keyId) {
        icon.setFrame(this.frameByTileId.get(keyId) ?? 0);
        icon.setVisible(true);
      } else {
        icon.setVisible(false);
      }
    }
  }

  private clearInventory(): void {
    for (const icon of this.topRowIcons) {
      icon.setVisible(false);
    }
    for (const icon of this.toolIcons.values()) {
      icon.setVisible(false);
    }
  }

  ignoreInBoardCamera(cam: Phaser.Cameras.Scene2D.Camera): void {
    if (this.root) {
      cam.ignore(this.root);
    }
    for (const display of [this.levelDisplay, this.timeDisplay, this.chipsDisplay]) {
      if (display) {
        cam.ignore(display);
      }
    }
    for (const icon of this.topRowIcons) {
      cam.ignore(icon);
    }
    for (const icon of this.toolIcons.values()) {
      cam.ignore(icon);
    }
  }

  destroy(): void {
    this.root?.destroy(true);
    this.levelDisplay?.destroy(true);
    this.timeDisplay?.destroy(true);
    this.chipsDisplay?.destroy(true);
    for (const icon of this.topRowIcons) {
      icon.destroy(true);
    }
    for (const icon of this.toolIcons.values()) {
      icon.destroy(true);
    }
    this.root = undefined;
    this.staticLevelNumber = null;
    this.levelDisplay = undefined;
    this.timeDisplay = undefined;
    this.chipsDisplay = undefined;
    this.topRowIcons.length = 0;
    this.toolIcons.clear();
  }
}

function parseLevelNumber(id: string): number {
  const match = /(\d+)\s*$/.exec(id);
  return match ? Number.parseInt(match[1]!, 10) : 0;
}
