import Phaser from "phaser";
import type { MsLevelIntroPanelLayout, MsWindowLayout } from "./msWindowLayout.js";
import {
  MS_LEVEL_INTRO_PANEL_FRAME,
  MS_WINDOW_TEXTURE,
  registerMsLevelIntroPanelFrame,
} from "./msWindowLayout.js";

const DEFAULT_SOURCE = { x: 177, y: 425, width: 184, height: 56 };
const DEFAULT_OFFSET_BELOW_CHIP_Y = 54;
const DEFAULT_FONT_SIZE_PX = 14;

/**
 * MS password/title panel on the playfield (spritesheet chrome + yellow text).
 * Board camera only; dismissed on first move.
 */
export class MsLevelIntroBanner {
  private root?: Phaser.GameObjects.Container;

  show(
    scene: Phaser.Scene,
    layout: MsWindowLayout,
    chipCenterX: number,
    chipCenterY: number,
    levelTitle: string,
    password: string,
  ): void {
    this.dismiss();

    if (!scene.textures.exists(MS_WINDOW_TEXTURE)) {
      return;
    }

    registerMsLevelIntroPanelFrame(scene.textures, layout);

    const spec: MsLevelIntroPanelLayout = {
      ...DEFAULT_SOURCE,
      ...layout.levelIntroPanel,
    };

    const frame = scene.textures.getFrame(
      MS_WINDOW_TEXTURE,
      MS_LEVEL_INTRO_PANEL_FRAME,
    );
    if (!frame) {
      return;
    }

    const panelH = frame.height;
    const belowChipY = spec.offsetBelowChipY ?? DEFAULT_OFFSET_BELOW_CHIP_Y;
    const fontSizePx = spec.fontSize ?? DEFAULT_FONT_SIZE_PX;
    const defaultRowOffset = Math.max(10, Math.round(panelH * 0.22));
    const titleY = spec.titleOffsetY ?? -defaultRowOffset;
    const passwordY = spec.passwordOffsetY ?? defaultRowOffset;
    const titleX = spec.titleOffsetX ?? 0;
    const passwordX = spec.passwordOffsetX ?? 48;

    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: `${fontSizePx}px`,
      fontStyle: "bold",
      color: "#ffff00",
      align: "center",
    };
    const passwordStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      ...titleStyle,
      align: "left",
    };

    const root = scene.add
      .container(chipCenterX, chipCenterY + belowChipY)
      .setDepth(50);

    const panel = scene.add
      .image(0, 0, MS_WINDOW_TEXTURE, MS_LEVEL_INTRO_PANEL_FRAME)
      .setOrigin(0.5, 0.5);
    panel.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    const line1 = levelTitle.trim() || "Level";
    const code = (password.trim().slice(0, 4) || "----").toUpperCase();

    const text1 = scene.add
      .text(titleX, titleY, line1, titleStyle)
      .setOrigin(0.5, 0.5);
    const text2 = scene.add
      .text(passwordX, passwordY, code, passwordStyle)
      .setOrigin(0, 0.5);

    root.add([panel, text1, text2]);
    this.root = root;
  }

  getRoot(): Phaser.GameObjects.Container | undefined {
    return this.root;
  }

  dismiss(): void {
    this.root?.destroy(true);
    this.root = undefined;
  }
}
