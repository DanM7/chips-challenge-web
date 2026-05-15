import Phaser from "phaser";

export interface DigitGlyph {
  file: string;
  width: number;
  height: number;
}

export interface DigitsManifest {
  cellWidth: number;
  chars: string;
  glyphs: Record<string, DigitGlyph>;
}

const DIGITS_BASE = "/games/chips-challenge-100/sprites/digits";

export function getDigitTextureKey(ch: string): string {
  return ch === "-" ? "ms_digit_dash" : `ms_digit_${ch}`;
}

export async function loadDigitsManifest(url: string): Promise<DigitsManifest> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load digits manifest: ${url}`);
  }
  return (await res.json()) as DigitsManifest;
}

/** Load each digit as its own texture (tight crops — no spritesheet bleed). */
export function preloadMsDigitTextures(
  scene: Phaser.Scene,
  manifest: DigitsManifest,
): void {
  for (const ch of manifest.chars) {
    const glyph = manifest.glyphs[ch];
    if (!glyph) continue;

    const key = getDigitTextureKey(ch);
    if (scene.textures.exists(key)) continue;

    scene.load.image(key, `${DIGITS_BASE}/${glyph.file}`);
  }
}

export async function ensureMsDigitTextures(
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
