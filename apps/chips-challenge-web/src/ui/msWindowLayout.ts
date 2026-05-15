import type Phaser from "phaser";

export interface MsWindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MsWindowLayout {
  id: string;
  ruleset: string;
  source: string;
  sourceNote?: string;
  frame: MsWindowRect;
  boardViewport: MsWindowRect & { cells: number; cellPixels: number };
  displays: Record<
    "level" | "time" | "chips",
    MsWindowRect & { maxDigits: number }
  >;
  digitsUrl?: string;
  digits: {
    /** Width of each digit slot in the HUD display rects. */
    displayCellWidth: number;
    /** Nudge the whole 3-digit block horizontally. */
    offsetX?: number;
    /** Fine-tune vertical placement (negative = up). */
    offsetY?: number;
    /** Per-digit horizontal nudge (left → right). */
    digitOffsetX?: number[];
  };
  inventory: {
    slotWidth: number;
    slotHeight: number;
    origin: { x: number; y: number };
    columnStep: number;
    rowStep: number;
    slots: Array<{ id: string; col: number; row: number; tileId: string }>;
  };
}

/** Full spritesheet — chrome crop only; do not add sub-frames here. */
export const MS_WINDOW_TEXTURE = "ms_window";
export const MS_CHROME_FRAME = "chrome";

export async function loadMsWindowLayout(url: string): Promise<MsWindowLayout> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load MS window layout: ${url}`);
  }
  return (await res.json()) as MsWindowLayout;
}

/** Single cropped frame for the green HUD (avoids setCrop bleed/offset bugs). */
export function registerMsChromeFrame(
  textures: Phaser.Textures.TextureManager,
  layout: MsWindowLayout,
): void {
  const { frame } = layout;
  const texture = textures.get(MS_WINDOW_TEXTURE);
  if (!texture) {
    throw new Error(`Texture "${MS_WINDOW_TEXTURE}" must be loaded first`);
  }
  if (texture.has(MS_CHROME_FRAME)) return;

  texture.add(
    MS_CHROME_FRAME,
    0,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
  );
}

