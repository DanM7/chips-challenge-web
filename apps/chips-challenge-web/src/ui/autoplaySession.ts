/** Persistent auto-play run across levels (until game complete or user stops). */

export const STOP_AUTOPLAY_SESSION_EVENT = "stop-autoplay-session";

export const AUTOPLAY_LEVEL_START_DELAY_MS = 500;

let sessionActive = false;

export function isAutoplaySessionActive(): boolean {
  return sessionActive;
}

export function startAutoplaySession(): void {
  sessionActive = true;
  const banner = document.getElementById("autoplay-banner");
  if (banner) {
    banner.hidden = false;
  }
}

export function stopAutoplaySession(): void {
  if (!sessionActive) {
    return;
  }
  sessionActive = false;
  const banner = document.getElementById("autoplay-banner");
  if (banner) {
    banner.hidden = true;
  }
}

export function initAutoplayBanner(game: Phaser.Game): void {
  const stopBtn = document.getElementById("autoplay-banner-stop");
  stopBtn?.addEventListener("click", () => {
    game.events.emit(STOP_AUTOPLAY_SESSION_EVENT);
  });
}
