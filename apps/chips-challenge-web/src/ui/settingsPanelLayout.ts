const INSET_PX = 15;

/**
 * Pin the settings window over the **game canvas** (#game-container), not the full
 * play-stage flex box (which can extend past the canvas) or the control-rail column
 * (which is wider than the touch input band). Same horizontal edge as the header band
 * in mobileHeaderBand.ts: gameRect.right / gameRect.left.
 */
export function updateSettingsPanelLayout(
  panel: HTMLElement,
  playRow: HTMLElement | null,
): void {
  if (!playRow) {
    return;
  }

  const playStage = playRow.querySelector<HTMLElement>(".play-stage");
  const gameEl = document.getElementById("game-container");
  const controlRail = playRow.querySelector<HTMLElement>(".control-rail");
  const touchControls = document.getElementById("touch-controls");

  if (!playStage) {
    return;
  }

  const stage = playStage.getBoundingClientRect();
  const game = gameEl?.getBoundingClientRect();

  let left = (game?.left ?? stage.left) + INSET_PX;
  let top = (game?.top ?? stage.top) + INSET_PX;
  let right = (game?.right ?? stage.right) - INSET_PX;
  let bottom = (game?.bottom ?? stage.bottom) - INSET_PX;

  const touchActive = playRow.classList.contains("play-row--touch-active");
  const touchVisible = Boolean(touchControls && !touchControls.hidden);

  if (touchActive && touchVisible) {
    const controlsLeft = playRow.classList.contains("play-row--controls-left");
    const portrait = playRow.classList.contains("play-row--portrait");

    if (portrait && controlRail) {
      // Game on top; input pane (header + controls) below — stop above that strip
      const rail = controlRail.getBoundingClientRect();
      bottom = Math.min(bottom, rail.top - INSET_PX);
    } else if (game) {
      // Landscape: panel covers the canvas; 15px gap before the input pane at the canvas edge
      if (controlsLeft) {
        left = game.left + INSET_PX;
        if (controlRail) {
          const rail = controlRail.getBoundingClientRect();
          left = Math.max(left, rail.right + INSET_PX);
        }
      } else {
        right = game.right - INSET_PX;
      }
    }
  }

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.width = `${Math.max(0, right - left)}px`;
  panel.style.height = `${Math.max(0, bottom - top)}px`;
}
