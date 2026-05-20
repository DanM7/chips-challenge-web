import Phaser from "phaser";
import type { DigitPalette, DigitsManifest } from "./msDigits.js";
import { getDigitTextureKey } from "./msDigits.js";
import type { MsWindowLayout } from "./msWindowLayout.js";

/** Three-digit 7-segment readout positioned over the MS window chrome. */
export class MsSevenSegment extends Phaser.GameObjects.Container {
  private readonly digitSprites: Phaser.GameObjects.Image[] = [];
  private readonly layout: MsWindowLayout;
  private readonly digits: DigitsManifest;
  private readonly displayKey: "level" | "time" | "chips";
  private palette: DigitPalette;
  private lastLayout = "";

  constructor(
    scene: Phaser.Scene,
    layout: MsWindowLayout,
    digits: DigitsManifest,
    displayKey: "level" | "time" | "chips",
    palette: DigitPalette = "green",
  ) {
    super(scene, 0, 0);
    this.layout = layout;
    this.digits = digits;
    this.displayKey = displayKey;
    this.palette = palette;

    const spec = layout.displays[displayKey];

    for (let i = 0; i < spec.maxDigits; i++) {
      const img = scene.add.image(0, 0, getDigitTextureKey("0", palette));
      img.setOrigin(0, 0);
      img.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.digitSprites.push(img);
      this.add(img);
    }

    this.layoutDigits("");
    this.setDepth(30);
  }

  setPalette(palette: DigitPalette): void {
    if (this.palette === palette) return;
    this.palette = palette;
    this.layoutDigits(this.lastLayout);
  }

  setDigits(text: string): void {
    if (text === "---") {
      this.layoutDigits("---");
      return;
    }
    const spec = this.layout.displays[this.displayKey];
    const trimmed = text.slice(-spec.maxDigits);
    this.layoutDigits(trimmed);
  }

  setValue(value: number | null, blank = "---"): void {
    if (value == null) {
      this.setDigits(blank);
      return;
    }
    const n = Math.max(0, Math.min(999, Math.floor(value)));
    this.setDigits(String(n));
  }

  /** Right-aligned; no leading zeros (MS shows `2`, not `002`). */
  private layoutDigits(text: string): void {
    this.lastLayout = text;
    const spec = this.layout.displays[this.displayKey];
    const glyphs = this.digits.palettes[this.palette].glyphs;
    const maxDigits = spec.maxDigits;
    const { offsetX = 0, offsetY = 0, digitOffsetX = [] } = this.layout.digits;
    const defaultCellW = this.digits.cellWidth;

    const glyphHeights = Object.values(glyphs).map((g) => g.height);
    const maxH = glyphHeights.length > 0 ? Math.max(...glyphHeights) : 21;
    const baseY = spec.y + Math.floor((spec.height - maxH) / 2) + offsetY;

    const chars: string[] = [];
    if (text === "---") {
      for (let i = 0; i < maxDigits; i++) {
        chars.push(text[i] ?? "-");
      }
    } else {
      const digitChars = text.split("");
      const leadingBlank = maxDigits - digitChars.length;
      for (let i = 0; i < leadingBlank; i++) {
        chars.push(" ");
      }
      for (const d of digitChars) {
        chars.push(d);
      }
    }

    const cellW = defaultCellW;
    const totalW = cellW * maxDigits;
    let cellX = spec.x + spec.width - totalW + offsetX;

    for (let i = 0; i < maxDigits; i++) {
      const ch = chars[i] ?? " ";
      const sprite = this.digitSprites[i]!;
      const g = glyphs[ch];

      if (!g || ch === " ") {
        sprite.setVisible(false);
        cellX += cellW;
        continue;
      }

      sprite.setVisible(true);
      sprite.setTexture(getDigitTextureKey(ch, this.palette));
      sprite.setPosition(
        cellX + cellW - g.width + (digitOffsetX[i] ?? 0),
        baseY + Math.floor((maxH - g.height) / 2),
      );
      cellX += cellW;
    }
  }
}
