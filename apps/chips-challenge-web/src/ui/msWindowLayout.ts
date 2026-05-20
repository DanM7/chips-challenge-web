import type Phaser from "phaser";

export interface MsWindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MsLevelIntroPanelLayout extends MsWindowRect {
  /**
   * `x`, `y`, `width`, `height` = source crop on spritesheet_window.png.
   * The banner is drawn at that frame's native pixel size (not stretched).
   */
  /** Distance below Chip center to banner center (game pixels). */
  offsetBelowChipY?: number;
  /** Text size in pixels (Phaser fontSize). */
  fontSize?: number;
  /** Title line position inside the panel (negative = up). */
  titleOffsetY?: number;
  /** Password line position inside the panel (negative = up). */
  passwordOffsetY?: number;
  titleOffsetX?: number;
  /** Horizontal start of the 4-letter code (panel-centered coords; positive = right). */
  passwordOffsetX?: number;
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
  /**
   * Level intro banner on the playfield.
   * `x`/`y` = crop on spritesheet_window.png (for optional texture frame).
   * `width`/`height` = drawn panel size in game pixels.
   */
  levelIntroPanel?: MsLevelIntroPanelLayout;
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
    /** Nudge the whole key row (negative = up). */
    keyRowOffsetY?: number;
    /** Nudge the whole bottom tool row (negative = up). */
    toolRowOffsetY?: number;
    slots: Array<{ id: string; col: number; row: number; tileId: string; offsetX?: number }>;
  };
}

/** Full spritesheet — chrome crop only; do not add sub-frames here. */
export const MS_WINDOW_TEXTURE = "ms_window";
export const MS_CHROME_FRAME = "chrome";
export const MS_LEVEL_INTRO_PANEL_FRAME = "level_intro_panel";

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

export function registerMsLevelIntroPanelFrame(
  textures: Phaser.Textures.TextureManager,
  layout: MsWindowLayout,
): void {
  const panel = layout.levelIntroPanel;
  if (!panel) return;

  const texture = textures.get(MS_WINDOW_TEXTURE);
  if (!texture) {
    throw new Error(`Texture "${MS_WINDOW_TEXTURE}" must be loaded first`);
  }
  if (texture.has(MS_LEVEL_INTRO_PANEL_FRAME)) {
    texture.remove(MS_LEVEL_INTRO_PANEL_FRAME);
  }

  texture.add(
    MS_LEVEL_INTRO_PANEL_FRAME,
    0,
    panel.x,
    panel.y,
    panel.width,
    panel.height,
  );
}

