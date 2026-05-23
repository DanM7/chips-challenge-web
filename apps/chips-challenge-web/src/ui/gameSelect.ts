/** Playable game / pack selection in Settings → Game. */
export type GameSelectId =
  | "cc1-win95"
  | "cc2-2015"
  | "level-pack-1"
  | "level-pack-2"
  | "level-pack-3";

export const AVAILABLE_GAME_SELECT_ID: GameSelectId = "cc1-win95";

export const GAME_SELECT_OPTIONS: ReadonlyArray<{
  id: GameSelectId;
  label: string;
  available: boolean;
}> = [
  { id: "cc1-win95", label: "Chip's Challenge 1 (Windows 95)", available: true },
  { id: "cc2-2015", label: "Chip's Challenge 2 (2015)", available: false },
  { id: "level-pack-1", label: "Chip's Challenge Level Pack 1", available: false },
  { id: "level-pack-2", label: "Chip's Challenge Level Pack 2", available: false },
  { id: "level-pack-3", label: "Chip's Challenge Level Pack 3", available: false },
];

const STORAGE_KEY = "cc1-selected-game";

export function isGameSelectId(value: string): value is GameSelectId {
  return GAME_SELECT_OPTIONS.some((option) => option.id === value);
}

export function loadSelectedGameId(): GameSelectId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === AVAILABLE_GAME_SELECT_ID) {
      return AVAILABLE_GAME_SELECT_ID;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return AVAILABLE_GAME_SELECT_ID;
}

export function saveSelectedGameId(id: GameSelectId): void {
  if (id !== AVAILABLE_GAME_SELECT_ID) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function isGameSelectAvailable(id: GameSelectId): boolean {
  return GAME_SELECT_OPTIONS.find((option) => option.id === id)?.available ?? false;
}
