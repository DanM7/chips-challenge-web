import Phaser from "phaser";
import type { DigitsManifest } from "./msDigits.js";
import { getDigitTextureKey } from "./msDigits.js";
import type { MsWindowLayout } from "./msWindowLayout.js";

/** Three-digit 7-segment readout positioned over the MS window chrome. */
export class MsSevenSegment extends Phaser.GameObjects.Container {
  private readonly digitSprites: Phaser.GameObjects.Image[] = [];
  private readonly layout: MsWindowLayout;
  private readonly digits: DigitsManifest;
  private readonly displayKey: "level" | "time" | "chips";

  constructor(
    scene: Phaser.Scene,
    layout: MsWindowLayout,
    digits: DigitsManifest,
    displayKey: "level" | "time" | "chips",
  ) {
    super(scene, 0, 0);
    this.layout = layout;
    this.digits = digits;
    this.displayKey = displayKey;

    const spec = layout.displays[displayKey];

    for (let i = 0; i < spec.maxDigits; i++) {
      const img = scene.add.image(0, 0, getDigitTextureKey("0"));
      img.setOrigin(0, 0);
      img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.digitSprites.push(img);
      this.add(img);
    }

    this.layoutDigits("000");

    this.setDepth(30);
  }

  setDigits(text: string): void {
    if (text === "---") {
      this.layoutDigits("---");
      return;
    }
    const spec = this.layout.displays[this.displayKey];
    const padded = text.padStart(spec.maxDigits, "0").slice(-spec.maxDigits);
    this.layoutDigits(padded);
  }

  setValue(value: number | null, blank = "---"): void {
    if (value == null) {
      this.setDigits(blank);
      return;
    }
    const n = Math.max(0, Math.min(999, Math.floor(value)));
    this.setDigits(String(n));
  }

  private layoutDigits(padded: string): void {
    const spec = this.layout.displays[this.displayKey];
    const glyphs = this.digits.glyphs;
    const {
      displayCellWidth: cellW,
      offsetX = 0,
      offsetY = 0,
      digitOffsetX = [],
    } = this.layout.digits;
    const maxH = Math.max(...Object.values(glyphs).map((g) => g.height));
    const totalW = cellW * spec.maxDigits;
    const baseY = spec.y + Math.floor((spec.height - maxH) / 2) + offsetY;
    let cellX = spec.x + spec.width - totalW + offsetX;

    for (let i = 0; i < spec.maxDigits; i++) {
      const ch = padded[i] ?? "0";
      const sprite = this.digitSprites[i]!;
      const g = glyphs[ch];

      if (!g || ch === " ") {
        sprite.setVisible(false);
        cellX += cellW;
        continue;
      }

      sprite.setVisible(true);
      sprite.setTexture(getDigitTextureKey(ch));
      sprite.setDisplaySize(g.width, g.height);
      sprite.setPosition(
        cellX + cellW - g.width + (digitOffsetX[i] ?? 0),
        baseY + Math.floor((maxH - g.height) / 2),
      );
      cellX += cellW;
    }
  }
}
