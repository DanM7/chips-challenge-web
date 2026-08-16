import Phaser from "phaser";

/** MS play window chrome size (spritesheet_window.png frame crop). */
export const MS_WINDOW_WIDTH = 511;
export const MS_WINDOW_HEIGHT = 351;

/** @deprecated Use MS_WINDOW_WIDTH — internal canvas matches the MS window frame. */
export const MS_GAME_WIDTH = MS_WINDOW_WIDTH;

/** @deprecated Use MS_WINDOW_HEIGHT */
export const MS_GAME_HEIGHT = MS_WINDOW_HEIGHT;

const REGISTRY_KEY = "pixelZoom";

let applyingZoom = false;

export function getPixelZoom(game: Phaser.Game): number {
  return (game.registry.get(REGISTRY_KEY) as number | undefined) ?? 1;
}

export function setPixelZoom(game: Phaser.Game, zoom: number): void {
  game.registry.set(REGISTRY_KEY, Phaser.Math.Clamp(Math.floor(zoom), 1, 8));
  game.events.emit("pixel-zoom-changed");
}

export function bumpPixelZoom(game: Phaser.Game, delta: number): void {
  setPixelZoom(game, getPixelZoom(game) + delta);
}

/** Integer scale only — keeps pixel art sharp (no browser-style fractional scaling). */
export function applyIntegerDisplayZoom(
  scale: Phaser.Scale.ScaleManager,
  parentEl: HTMLElement | null,
): number {
  if (applyingZoom) {
    return getPixelZoom(scale.game);
  }

  if (!parentEl || parentEl.clientWidth < 16 || parentEl.clientHeight < 16) {
    return getPixelZoom(scale.game);
  }

  const baseW = MS_WINDOW_WIDTH;
  const baseH = MS_WINDOW_HEIGHT;
  const fitW = parentEl.clientWidth / baseW;
  const fitH = parentEl.clientHeight / baseH;
  const zoom = Math.max(1, Math.floor(Math.min(fitW, fitH)));

  scale.game.registry.set(REGISTRY_KEY, zoom);

  applyingZoom = true;
  try {
    if (scale.zoom !== zoom) {
      scale.setZoom(zoom);
    }
  } finally {
    applyingZoom = false;
  }

  return zoom;
}
