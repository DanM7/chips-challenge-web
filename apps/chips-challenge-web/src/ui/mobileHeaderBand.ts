import { isControlsOnLeft, type TouchControlMode } from "./controlMode";

/** Size the blue bar from the screen edge to the play window (landscape touch only). */
export function updateMobileHeaderBand(
  playRow: HTMLElement,
  mode: TouchControlMode,
  landscape: boolean,
): void {
  const header = playRow.querySelector<HTMLElement>(".control-rail .app-header");
  const gameEl = document.getElementById("game-container");

  if (!header) {
    return;
  }

  if (!landscape || !gameEl) {
    clearMobileHeaderBand(playRow, header);
    return;
  }

  const rowRect = playRow.getBoundingClientRect();
  const gameRect = gameEl.getBoundingClientRect();
  const controlsLeft = isControlsOnLeft(mode);

  let bandLeft: number;
  let bandWidth: number;

  if (controlsLeft) {
    bandLeft = 0;
    bandWidth = Math.max(0, Math.round(gameRect.left - rowRect.left));
    header.style.left = "0";
    header.style.right = "auto";
    header.style.width = `${bandWidth}px`;
  } else {
    bandLeft = Math.round(gameRect.right - rowRect.left);
    bandWidth = Math.max(0, Math.round(rowRect.right - gameRect.right));
    header.style.left = `${bandLeft}px`;
    header.style.right = "auto";
    header.style.width = `${bandWidth}px`;
  }

  playRow.style.setProperty("--header-band-height", `${header.offsetHeight}px`);
  playRow.style.setProperty("--control-band-left", `${bandLeft}px`);
  playRow.style.setProperty("--control-band-width", `${bandWidth}px`);
}

export function clearMobileHeaderBand(playRow: HTMLElement, header?: HTMLElement | null): void {
  const el = header ?? playRow.querySelector<HTMLElement>(".control-rail .app-header");
  playRow.style.removeProperty("--header-band-height");
  playRow.style.removeProperty("--control-band-left");
  playRow.style.removeProperty("--control-band-width");
  if (!el) {
    return;
  }
  el.style.removeProperty("width");
  el.style.removeProperty("left");
  el.style.removeProperty("right");
}
