/** D-pad button size tier (persisted). Medium matches the default layout scale. */
export type DpadButtonSize = "small" | "medium" | "large";

/** How far apart the four direction buttons sit (persisted). */
export type DpadButtonSpacing = "small" | "medium" | "large";

export const DPAD_BUTTON_SIZES: readonly DpadButtonSize[] = ["small", "medium", "large"] as const;

export const DPAD_BUTTON_SPACINGS: readonly DpadButtonSpacing[] = [
  "small",
  "medium",
  "large",
] as const;

export const DPAD_BUTTON_SIZE_LABELS: Record<DpadButtonSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export const DPAD_BUTTON_SPACING_LABELS: Record<DpadButtonSpacing, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

const SIZE_STORAGE_KEY = "cc1-dpad-button-size";
const SPACING_STORAGE_KEY = "cc1-dpad-button-spacing";

export const DEFAULT_DPAD_BUTTON_SIZE: DpadButtonSize = "medium";
export const DEFAULT_DPAD_BUTTON_SPACING: DpadButtonSpacing = "medium";

/** Rem base before tier scale (medium = 1×). */
const BTN_SIZE_BASE_REM = {
  landscape: 4.4,
  portrait: 6,
} as const;

const SIZE_SCALE: Record<DpadButtonSize, number> = {
  small: 0.75,
  medium: 1,
  large: 1.25,
};

const DPAD_SPACING_CLASS_PREFIX = "play-row--dpad-spacing-";

export function isDpadButtonSize(value: string): value is DpadButtonSize {
  return (DPAD_BUTTON_SIZES as readonly string[]).includes(value);
}

export function isDpadButtonSpacing(value: string): value is DpadButtonSpacing {
  return (DPAD_BUTTON_SPACINGS as readonly string[]).includes(value);
}

export function loadDpadButtonSize(): DpadButtonSize {
  try {
    const raw = localStorage.getItem(SIZE_STORAGE_KEY);
    if (raw && isDpadButtonSize(raw)) {
      return raw;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return DEFAULT_DPAD_BUTTON_SIZE;
}

export function saveDpadButtonSize(size: DpadButtonSize): void {
  try {
    localStorage.setItem(SIZE_STORAGE_KEY, size);
  } catch {
    /* ignore */
  }
}

export function loadDpadButtonSpacing(): DpadButtonSpacing {
  try {
    const raw = localStorage.getItem(SPACING_STORAGE_KEY);
    if (raw && isDpadButtonSpacing(raw)) {
      return raw;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return DEFAULT_DPAD_BUTTON_SPACING;
}

export function saveDpadButtonSpacing(spacing: DpadButtonSpacing): void {
  try {
    localStorage.setItem(SPACING_STORAGE_KEY, spacing);
  } catch {
    /* ignore */
  }
}

export function resolveDpadButtonSizeRem(
  tier: DpadButtonSize,
  layout: "landscape" | "portrait",
): string {
  const base = layout === "landscape" ? BTN_SIZE_BASE_REM.landscape : BTN_SIZE_BASE_REM.portrait;
  return `${base * SIZE_SCALE[tier]}rem`;
}

function syncDpadSpacingClass(playRow: HTMLElement, tier: DpadButtonSpacing): void {
  for (const spacing of DPAD_BUTTON_SPACINGS) {
    playRow.classList.toggle(`${DPAD_SPACING_CLASS_PREFIX}${spacing}`, spacing === tier);
  }
}

/** Apply button size and spacing tier on the play row (inherited / class-driven). */
export function applyDpadPreferences(
  playRow: HTMLElement,
  layout: { landscape: boolean },
  sizeTier: DpadButtonSize = loadDpadButtonSize(),
  spacingTier: DpadButtonSpacing = loadDpadButtonSpacing(),
): void {
  const layoutKey = layout.landscape ? "landscape" : "portrait";
  playRow.style.setProperty("--dpad-btn-size", resolveDpadButtonSizeRem(sizeTier, layoutKey));
  syncDpadSpacingClass(playRow, spacingTier);
}

export function clearDpadPreferenceVars(playRow: HTMLElement): void {
  playRow.style.removeProperty("--dpad-btn-size");
  for (const spacing of DPAD_BUTTON_SPACINGS) {
    playRow.classList.remove(`${DPAD_SPACING_CLASS_PREFIX}${spacing}`);
  }
}
