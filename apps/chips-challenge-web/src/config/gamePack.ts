/** Committed game pack id (must match `public/games/<id>/manifest.json`). */
export const GAME_PACK_ID = "chips-challenge-1";

export const GAME_PACK_BASE = `/games/${GAME_PACK_ID}`;

export const MANIFEST_URL = `${GAME_PACK_BASE}/manifest.json`;

/** MS CHIPS.EXE tile sheet (32×32); committed under `public/games/.../sprites/`. */
export const MS_TILES_PNG_URL = `${GAME_PACK_BASE}/sprites/ms-tiles.png`;
export const MS_TILES_JSON_URL = `${GAME_PACK_BASE}/sprites/ms-tiles.json`;

export const MS_AUDIO_BASE = `${GAME_PACK_BASE}/audio`;
