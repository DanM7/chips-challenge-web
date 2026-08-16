import type { LevelsIndex, OriginalLevelReferenceDoc } from "./types.js";

/** Phaser registry key for a level jump requested before PlayScene is ready. */
export const REGISTRY_PENDING_LEVEL_NUMBER = "pendingLevelNumber";

/** Fallback when `levels/index.json` has no valid `defaultLevelId`. */
export const DEFAULT_LAUNCH_LEVEL_ID = "level-001";

/** Parsed from `DEFAULT_LAUNCH_LEVEL_ID`; last-resort numeric fallback. */
export const DEFAULT_LAUNCH_LEVEL_NUMBER = 1;

/** Normalize a user-entered MS level password (4 ASCII letters, case-insensitive). */
export function normalizeLevelPassword(raw: string): string {
  return raw.trim().toUpperCase().slice(0, 4);
}

/** `level-008` → 8; returns null if the id format is not recognized. */
export function levelNumberFromLevelId(levelId: string): number | null {
  const match = /^level-(\d+)$/i.exec(levelId.trim());
  if (!match) {
    return null;
  }
  const n = Number.parseInt(match[1]!, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Default CC1 level number for a fresh load.
 * Prefer `levels/index.json` → `defaultLevelId`; else `DEFAULT_LAUNCH_LEVEL_ID`.
 */
export function resolveDefaultLaunchLevelNumber(
  index?: Pick<LevelsIndex, "defaultLevelId"> | null,
): number {
  const fromIndex = index?.defaultLevelId
    ? levelNumberFromLevelId(index.defaultLevelId)
    : null;
  if (fromIndex != null) {
    return fromIndex;
  }
  return (
    levelNumberFromLevelId(DEFAULT_LAUNCH_LEVEL_ID) ?? DEFAULT_LAUNCH_LEVEL_NUMBER
  );
}

/** Map an MS level password (e.g. `JXMJ`) to CC1 level number, or null if unknown. */
export function resolveLevelNumberFromPassword(
  doc: OriginalLevelReferenceDoc,
  password: string,
): number | null {
  const normalized = normalizeLevelPassword(password);
  if (normalized.length !== 4) {
    return null;
  }
  const match = doc.levels.find((level) => level.passwordMs.toUpperCase() === normalized);
  return match?.number ?? null;
}

/** MS password for a level number (for dev URLs / menus). */
export function resolvePasswordForLevelNumber(
  doc: OriginalLevelReferenceDoc,
  levelNumber: number,
): string | null {
  const match = doc.levels.find((level) => level.number === levelNumber);
  return match?.passwordMs ?? null;
}
