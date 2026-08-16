/** Cardinal directions for grid movement (Chip's Challenge–style). */
export type Direction = "up" | "down" | "left" | "right";

/** Root manifest for a game title; lives in `public/games/<id>/manifest.json`. */
export interface GameManifest {
  id: string;
  title: string;
  version?: string;
  /** Phaser overrides merged into the engine bootstrap config. */
  phaser?: Partial<Phaser.Types.Core.GameConfig>;
  /** Scene key to boot first (must exist in the engine scene registry). */
  initialScene: string;
  /** Optional JSON listing image/spritesheet/tilemap/audio URLs by key. */
  assetManifestUrl?: string;
  /** Optional JSON index of level files. */
  levelsIndexUrl?: string;
  /** Legacy custom tile catalog (optional if using MS EXE tiles). */
  tilesetCatalogUrl?: string;
  /** Original MS/Lynx level metadata (passwords, time, bold). */
  originalLevelReferenceUrl?: string;
  /** MS assets served from vendor via /ms-assets (see vite.config). */
  msAssets?: {
    tilesUrl: string;
    tilesMetaUrl?: string;
    datPath?: string;
  };
  /** MS window chrome layout (frame crop, counters, inventory). */
  windowLayoutUrl?: string;
  /** @deprecated Use windowLayoutUrl */
  hudLayoutUrl?: string;
  /** CC1 level number to load when PlayScene starts (set by web bootstrap). */
  launchLevelNumber?: number;
}

/** MS Windows vs Lynx original-game reference (`data/original-level-reference.json`). */
export interface OriginalLevelMeta {
  number: number;
  title: string;
  passwordMs: string;
  passwordLynx: string;
  timeLimitSeconds: number | null;
  boldTargetMs: number;
  boldTargetLynx: number | null;
}

export interface OriginalLevelReferenceDoc {
  schemaVersion: number;
  description: string;
  levelCount: number;
  levels: OriginalLevelMeta[];
}

/** Maps each non-empty `tileIds` cell to a frame index (row-major). */
export interface TilesetCatalog {
  id: string;
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  tileIds: string[][];
  meta?: Record<string, unknown>;
}

/** Optional bundle of URLs keyed for Phaser loaders (extend per game). */
export interface AssetManifest {
  images?: Record<string, string>;
  spritesheets?: Record<string, { url: string; frameWidth: number; frameHeight: number }>;
  tilemaps?: Record<string, string>;
  audio?: Record<string, string>;
}

export interface LevelIndexEntry {
  id: string;
  name: string;
  url: string;
}

export interface LevelsIndex {
  levels: LevelIndexEntry[];
  defaultLevelId?: string;
}

export interface LevelMonster {
  x: number;
  y: number;
  direction: "north" | "east" | "south" | "west";
}

/** On-disk layer: leading empties omitted (see `emptyPrefix`). */
export interface LevelLayerCompact {
  /** Row-major index of the first stored tile; cells before this are `empty`. */
  emptyPrefix: number;
  tiles: string[];
}

/** Level JSON may use compact layers; loaders expand to full arrays. */
export interface LevelLayersSerialized {
  lower: string[] | LevelLayerCompact;
  upper: string[] | LevelLayerCompact;
}

/** Runtime layers after {@link normalizeLevelLayers} (always full `width` × `height`). */
export interface LevelLayers {
  lower: string[];
  upper: string[];
}

/** Initial HUD values extracted from DAT / compiler (see docs/ui-and-hud.md). */
export interface LevelHud {
  levelTitle: string;
  /** MS counter: 1–149 */
  levelNumber?: number;
  timer?: {
    mode: "countDown" | "countUp" | "none";
    initialSeconds: number;
  };
  chipCounter?: {
    /** MS-style: chips still needed to open the socket (DAT chips-required). */
    mode: "remaining";
    initial: number;
  };
  /** Pickup chips visible at level start (composite map scan; may be less than `initial` when chips are hidden). */
  collectiblesOnMap?: number;
}

/** Ruleset HUD chrome (e.g. MS inventory slot order). */
export interface HudLayout {
  id: string;
  ruleset: string;
  inventory: {
    keys: HudInventorySlot[];
    tools: HudInventorySlot[];
  };
}

export interface HudInventorySlot {
  id: string;
  label: string;
  /** CSS color for empty-slot chrome until tile icons are used. */
  color?: string;
}

/** Live run counters (ruleset-agnostic; MS HUD maps these to 7-segment displays). */
export interface RunState {
  /** Static for the level (MS: level index 1–149). */
  levelNumber: number;
  /** Countdown play clock in seconds; `null` = no limit / show dashes. */
  playClockSeconds: number | null;
  /** Collectibles still on the map (MS: chips left). */
  collectiblesLeftCount: number;
  /** Keys held, left → right in the HUD top row (e.g. `key_blue`). */
  inventory?: { keys: string[]; tools?: string[] };
}

/** @deprecated Use RunState */
export type RunStateHud = RunState & {
  levelTitle?: string;
  timer?: { secondsRemaining: number | null };
  chipCounter?: { remaining: number; required: number };
};

/** Runtime level (from hand-authored JSON or DAT conversion). */
export interface LevelData {
  id: string;
  name: string;
  /** Rules engine id (e.g. grid-arcade-v1). */
  ruleset?: string;
  /** Content pack id (e.g. ms-cc1). */
  contentPack?: string;
  width: number;
  height: number;
  tileSize: number;
  /**
   * On disk: compact `{ emptyPrefix, tiles }`; after {@link normalizeLevelLayers} always full arrays.
   * Typed as {@link LevelLayers} for runtime simulation (loaders expand before play).
   */
  layers: LevelLayers;
  timeLimit?: number;
  chipsRequired?: number;
  monsters?: LevelMonster[];
  trapLinks?: { button: { x: number; y: number }; trap: { x: number; y: number } }[];
  cloneLinks?: { button: { x: number; y: number }; clone: { x: number; y: number } }[];
  metadata?: {
    title?: string;
    hint?: string;
    passwordHash?: string;
    passwordPlain?: string;
  };
  /** Optional grid cell for the player; defaults to center when omitted. */
  playerStart?: { x: number; y: number };
  /** Status panel seed data (extraction pipeline → GameHud). */
  hud?: LevelHud;
}
