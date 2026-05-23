/** On/off toggle for music and sound effects (persisted). */
export type SoundToggle = "on" | "off";

export const SOUND_TOGGLES: readonly SoundToggle[] = ["on", "off"] as const;

const MUSIC_STORAGE_KEY = "cc1-music-enabled";
const SFX_STORAGE_KEY = "cc1-sound-effects-enabled";

export const DEFAULT_SOUND_TOGGLE: SoundToggle = "on";

export function isSoundToggle(value: string): value is SoundToggle {
  return (SOUND_TOGGLES as readonly string[]).includes(value);
}

function loadToggle(key: string): SoundToggle {
  try {
    const raw = localStorage.getItem(key);
    if (raw && isSoundToggle(raw)) {
      return raw;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return DEFAULT_SOUND_TOGGLE;
}

function saveToggle(key: string, value: SoundToggle): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function loadMusicEnabled(): SoundToggle {
  return loadToggle(MUSIC_STORAGE_KEY);
}

export function saveMusicEnabled(value: SoundToggle): void {
  saveToggle(MUSIC_STORAGE_KEY, value);
}

export function isMusicEnabled(): boolean {
  return loadMusicEnabled() === "on";
}

export function loadSoundEffectsEnabled(): SoundToggle {
  return loadToggle(SFX_STORAGE_KEY);
}

export function saveSoundEffectsEnabled(value: SoundToggle): void {
  saveToggle(SFX_STORAGE_KEY, value);
}

export function areSoundEffectsEnabled(): boolean {
  return loadSoundEffectsEnabled() === "on";
}
