import { MS_AUDIO_BASE } from "../config/gamePack";
import { areSoundEffectsEnabled } from "./soundPreferences";

const BUMMER_URL = `${MS_AUDIO_BASE}/BUMMER.WAV`;

/** Play MS “bummer” outside Phaser (e.g. settings UI). Respects Sound Effects setting. */
export function playBummerSfx(): void {
  if (!areSoundEffectsEnabled()) {
    return;
  }
  const audio = new Audio(BUMMER_URL);
  void audio.play().catch(() => {
    /* autoplay policy or missing file */
  });
}
