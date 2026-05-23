/** Touch control layout persisted in localStorage. */
export type TouchControlMode =
  | "arrows-right"
  | "arrows-left"
  | "joystick-right"
  | "joystick-left";

export const TOUCH_CONTROL_MODES: readonly TouchControlMode[] = [
  "arrows-right",
  "arrows-left",
  "joystick-right",
  "joystick-left",
] as const;

export const TOUCH_CONTROL_LABELS: Record<TouchControlMode, string> = {
  "arrows-right": "Direction Arrows on Right",
  "arrows-left": "Direction Arrows on Left",
  "joystick-right": "Joystick on Right",
  "joystick-left": "Joystick on Left",
};

const STORAGE_KEY = "cc1-touch-control-mode";
export const DEFAULT_TOUCH_CONTROL_MODE: TouchControlMode = "arrows-right";

export function isTouchControlMode(value: string): value is TouchControlMode {
  return (TOUCH_CONTROL_MODES as readonly string[]).includes(value);
}

export function loadTouchControlMode(): TouchControlMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isTouchControlMode(raw)) {
      return raw;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return DEFAULT_TOUCH_CONTROL_MODE;
}

export function saveTouchControlMode(mode: TouchControlMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Phones, tablets, and narrow viewports use the touch control strip. */
export function prefersTouchLayout(): boolean {
  return window.matchMedia("(hover: none), (pointer: coarse), (max-width: 720px)").matches;
}

/** Portrait: game on top, controls underneath (landscape uses side column). */
export function isPortraitViewport(): boolean {
  if (typeof window.matchMedia !== "function") {
    return window.innerHeight >= window.innerWidth;
  }
  return (
    window.matchMedia("(orientation: portrait)").matches ||
    window.matchMedia("(max-aspect-ratio: 1/1)").matches
  );
}

export function isJoystickMode(mode: TouchControlMode): boolean {
  return mode === "joystick-right" || mode === "joystick-left";
}

export function isControlsOnLeft(mode: TouchControlMode): boolean {
  return mode === "arrows-left" || mode === "joystick-left";
}
