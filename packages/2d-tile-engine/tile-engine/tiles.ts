/** CC1 object codes $00–$6F (MS / Tile World). */
export const TILE_NAMES: Record<number, string> = {
  0x00: "empty",
  0x01: "wall",
  0x02: "chip",
  0x03: "water",
  0x04: "fire",
  0x05: "invisible_wall",
  0x06: "blocked_n",
  0x07: "blocked_w",
  0x08: "blocked_s",
  0x09: "blocked_e",
  0x0a: "block_movable",
  0x0b: "dirt",
  0x0c: "ice",
  0x0d: "force_s",
  0x0e: "clone_block_n",
  0x0f: "clone_block_w",
  0x10: "clone_block_s",
  0x11: "clone_block_e",
  0x12: "force_n",
  0x13: "force_e",
  0x14: "force_w",
  0x15: "exit",
  0x16: "door_blue",
  0x17: "door_red",
  0x18: "door_green",
  0x19: "door_yellow",
  0x1a: "ice_se",
  0x1b: "ice_sw",
  0x1c: "ice_nw",
  0x1d: "ice_ne",
  0x1e: "block_blue_tile",
  0x1f: "block_blue_wall",
  0x20: "unused_20",
  0x21: "thief",
  0x22: "socket",
  0x23: "button_green",
  0x24: "button_red",
  0x25: "block_toggle_closed",
  0x26: "block_toggle_open",
  0x27: "button_brown",
  0x28: "button_blue",
  0x29: "teleport",
  0x2a: "bomb",
  0x2b: "trap",
  0x2c: "wall_appearing",
  0x2d: "gravel",
  0x2e: "hint_tile",
  0x2f: "hint",
  0x30: "blocked_se",
  0x31: "cloner",
  0x32: "force_any",
  0x33: "chip_drowning",
  0x34: "chip_burned",
  0x35: "chip_burned_2",
  0x36: "unused_36",
  0x37: "unused_37",
  0x38: "unused_38",
  0x39: "chip_exit",
  0x3a: "exit_3a",
  0x3b: "exit_3b",
  0x3c: "chip_swim_n",
  0x3d: "chip_swim_w",
  0x3e: "chip_swim_s",
  0x3f: "chip_swim_e",
  0x40: "bug_n",
  0x41: "bug_w",
  0x42: "bug_s",
  0x43: "bug_e",
  0x44: "fireball_n",
  0x45: "fireball_w",
  0x46: "fireball_s",
  0x47: "fireball_e",
  0x48: "ball_pink_n",
  0x49: "ball_pink_w",
  0x4a: "ball_pink_s",
  0x4b: "ball_pink_e",
  0x4c: "tank_n",
  0x4d: "tank_w",
  0x4e: "tank_s",
  0x4f: "tank_e",
  0x50: "ghost_n",
  0x51: "ghost_w",
  0x52: "ghost_s",
  0x53: "ghost_e",
  0x54: "frog_n",
  0x55: "frog_w",
  0x56: "frog_s",
  0x57: "frog_e",
  0x58: "walker_n",
  0x59: "walker_w",
  0x5a: "walker_s",
  0x5b: "walker_e",
  0x5c: "blob_n",
  0x5d: "blob_w",
  0x5e: "blob_s",
  0x5f: "blob_e",
  0x60: "teeth_n",
  0x61: "teeth_w",
  0x62: "teeth_s",
  0x63: "teeth_e",
  0x64: "key_blue",
  0x65: "key_red",
  0x66: "key_green",
  0x67: "key_yellow",
  0x68: "flippers",
  0x69: "fire_boots",
  0x6a: "ice_skates",
  0x6b: "suction_boots",
  0x6c: "chip_n",
  0x6d: "chip_w",
  0x6e: "chip_s",
  0x6f: "chip_e",
};

export const CC1_MAP_SIZE = 32;
export const CC1_TILE_COUNT = CC1_MAP_SIZE * CC1_MAP_SIZE;

export const CHIP_TILE_IDS = new Set([
  "chip_n",
  "chip_w",
  "chip_s",
  "chip_e",
  "chip_swim_n",
  "chip_swim_w",
  "chip_swim_s",
  "chip_swim_e",
]);

/** Pickup collectibles (MS chip tile), not the player avatar sprites. */
export const COLLECTIBLE_CHIP_TILE_ID = "chip";
export const SOCKET_TILE_ID = "socket";
export const BLOCK_MOVABLE_TILE_ID = "block_movable";
export const FLIPPERS_TILE_ID = "flippers";
export const FIRE_BOOTS_TILE_ID = "fire_boots";
export const CHIP_DROWNING_TILE_ID = "chip_drowning";
export const CHIP_BURNED_TILE_ID = "chip_burned";

export const TOOL_TILE_IDS = new Set([
  "flippers",
  "fire_boots",
  "ice_skates",
  "suction_boots",
]);

export const KEY_TILE_IDS = new Set([
  "key_blue",
  "key_red",
  "key_green",
  "key_yellow",
]);

export const DOOR_TILE_IDS = new Set([
  "door_blue",
  "door_red",
  "door_green",
  "door_yellow",
]);

const DOOR_TO_KEY: Record<string, string> = {
  door_blue: "key_blue",
  door_red: "key_red",
  door_green: "key_green",
  door_yellow: "key_yellow",
};

export function doorToKeyId(doorTileId: string): string | null {
  return DOOR_TO_KEY[doorTileId] ?? null;
}

export function isKeyTile(tileId: string): boolean {
  return KEY_TILE_IDS.has(tileId);
}

export function isDoorTile(tileId: string): boolean {
  return DOOR_TILE_IDS.has(tileId);
}

export function isSocketTile(tileId: string): boolean {
  return tileId === SOCKET_TILE_ID;
}

export function isBlockTile(tileId: string): boolean {
  return tileId === BLOCK_MOVABLE_TILE_ID;
}

/** MS monsters are acting walls to blocks (simplified name check). */
export function isMonsterTile(tileId: string): boolean {
  return /^(bug|ball|fireball|tank|ghost|frog|walker|blob|teeth)_/.test(tileId);
}

/** MS rules: green keys open any number of green doors and are not spent. */
export function isKeyConsumedWhenOpeningDoor(keyId: string): boolean {
  return keyId !== "key_green";
}

export const BUTTON_TILE_IDS = new Set([
  "button_green",
  "button_red",
  "button_brown",
  "button_blue",
]);

export function isButtonTile(tileId: string): boolean {
  return BUTTON_TILE_IDS.has(tileId);
}

export function isToggleWallTile(tileId: string): boolean {
  return tileId === "block_toggle_closed" || tileId === "block_toggle_open";
}

/** MS $2C invisible wall (will appear); shares pop-up timing with pass-once in many levels. */
export const WALL_APPEARING_TILE_ID = "wall_appearing";

/**
 * MS $2E "Pass Once" (recessed / pop-up wall). Exported levels use the misnomer `hint_tile`.
 * @see https://metacpan.org/pod/Data::ChipsChallenge (object hex table)
 */
export const PASS_ONCE_TILE_ID = "hint_tile";

/** Tiles Chip may step on once (movement uses `allowAppearingWall`). */
export const MS_POPUP_WALL_TILE_IDS = new Set([
  WALL_APPEARING_TILE_ID,
  PASS_ONCE_TILE_ID,
]);

/**
 * MS fake blue wall ($1E in many exports). Acts as dirt: removed permanently when Chip steps on it.
 * Real blue walls use `block_blue_wall` ($1F) and stay blocking.
 */
export const FAKE_BLUE_WALL_TILE_ID = "block_blue_tile";

export const BLOCKING_TILE_IDS = new Set([
  "wall",
  "invisible_wall",
  "blocked_n",
  "blocked_w",
  "blocked_s",
  "blocked_e",
  "blocked_se",
  "block_blue_wall",
  "block_toggle_closed",
  "cloner",
  "trap",
]);

/** Orthogonal thin walls: one edge is solid, the other axis is free (MS). */
export const THIN_WALL_ORTHOGONAL_TILE_IDS = new Set([
  "blocked_n",
  "blocked_s",
  "blocked_e",
  "blocked_w",
]);

/**
 * Whether a step (dx,dy) is blocked by MS thin walls on the source and/or dest tile.
 * `blocked_e` blocks leaving east / entering from the east; N–S along the tile is free.
 */
export function thinWallBlocksMove(
  fromTile: string,
  destTile: string,
  dx: number,
  dy: number,
): boolean {
  if (dy < 0 && (fromTile === "blocked_n" || destTile === "blocked_s")) return true;
  if (dy > 0 && (fromTile === "blocked_s" || destTile === "blocked_n")) return true;
  if (dx < 0 && (fromTile === "blocked_w" || destTile === "blocked_e")) return true;
  if (dx > 0 && (fromTile === "blocked_e" || destTile === "blocked_w")) return true;
  return false;
}

export function tileIdFromByte(byte: number): string {
  return TILE_NAMES[byte] ?? `unknown_${byte.toString(16).padStart(2, "0")}`;
}

/** MS object code ($00–$6F) for a tile id, or null if unknown. */
export function objectCodeFromTileId(tileId: string): number | null {
  for (const [code, name] of Object.entries(TILE_NAMES)) {
    if (name === tileId) return Number(code);
  }
  return null;
}

export function tileIdsFromBytes(bytes: number[]): string[] {
  return bytes.map(tileIdFromByte);
}
