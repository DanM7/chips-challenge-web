import Phaser from "phaser";

export type DigitPalette = "green" | "yellow";

export interface DigitGlyph {
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
  slotWidth?: number;
}

export interface DigitPaletteSpec {
  strip: { left: number; top: number; width: number; height: number };
  glyphs: Record<string, DigitGlyph>;
}

export interface DigitsManifest {
  cellWidth: number;
  chars: string;
  palettes: Record<DigitPalette, DigitPaletteSpec>;
}

const DIGITS_BASE = "/games/chips-challenge-1/sprites/digits";

export function getDigitTextureKey(ch: string, palette: DigitPalette): string {
  const glyph = ch === "-" ? "dash" : ch;
  return `ms_digit_${palette}_${glyph}`;
}

export async function loadDigitsManifest(url: string): Promise<DigitsManifest> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load digits manifest: ${url}`);
  }
  const raw = (await res.json()) as DigitsManifest & {
    glyphs?: Record<string, DigitGlyph>;
  };
  if (raw.palettes) {
    return raw as DigitsManifest;
  }
  // Legacy single-row manifest (green row only).
  return {
    cellWidth: raw.cellWidth,
    chars: raw.chars,
    palettes: {
      green: { strip: { left: 12, top: 375, width: 195, height: 22 }, glyphs: raw.glyphs ?? {} },
      yellow: { strip: { left: 12, top: 397, width: 195, height: 22 }, glyphs: raw.glyphs ?? {} },
    },
  };
}

export function preloadMsDigitTextures(
  scene: Phaser.Scene,
  manifest: DigitsManifest,
): void {
  for (const palette of ["green", "yellow"] as const) {
    const glyphs = manifest.palettes[palette].glyphs;
    for (const ch of manifest.chars) {
      const glyph = glyphs[ch];
      if (!glyph) continue;

      const key = getDigitTextureKey(ch, palette);
      if (scene.textures.exists(key)) continue;

      scene.load.image(key, `${DIGITS_BASE}/${palette}/${glyph.file}`);
    }
  }
}

export async function ensureMsDigitPalettes(
  scene: Phaser.Scene,
  manifest: DigitsManifest,
): Promise<void> {
  preloadMsDigitTextures(scene, manifest);
  if (scene.load.totalToLoad === 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.once("loaderror", () =>
      reject(new Error("Failed to load digit textures")),
    );
    scene.load.start();
  });
}
