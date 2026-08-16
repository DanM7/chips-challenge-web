import type { Direction } from "./types";
import type { GameEventBus } from "./GameEventBus";
import { MS_CHIP_WALK_STEP_MS } from "./msCc1/msCc1Monsters.js";

const DIR_ATTR = "data-dir";

/** Grid step interval while a direction is held — matches MS Chip walk rate. */
const REPEAT_INTERVAL_MS = MS_CHIP_WALK_STEP_MS;

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};

function isDirection(value: string): value is Direction {
  return value === "up" || value === "down" || value === "left" || value === "right";
}

function directionForKey(key: string): Direction | null {
  return KEY_TO_DIRECTION[key] ?? null;
}

/**
 * Maps on-screen D-pad buttons and keyboard arrows / WASD to direction events.
 * Holding a key or d-pad button repeats movement at a fixed interval.
 */
export class DirectionInput {
  private readonly bus: GameEventBus;
  private keyDownListener: ((event: KeyboardEvent) => void) | null = null;
  private keyUpListener: ((event: KeyboardEvent) => void) | null = null;
  private blurListener: (() => void) | null = null;
  private readonly heldKeys: string[] = [];
  private repeatTimer: ReturnType<typeof setInterval> | null = null;
  private activeDirection: Direction | null = null;
  private dpadPointerDown: ((event: PointerEvent) => void) | null = null;
  private dpadPointerUp: ((event: PointerEvent) => void) | null = null;
  private dpadHoldDirection: Direction | null = null;
  private swipeTarget: HTMLElement | null = null;
  private swipePointerId: number | null = null;
  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipePointerDown: ((event: PointerEvent) => void) | null = null;
  private swipePointerUp: ((event: PointerEvent) => void) | null = null;

  /** Minimum swipe distance (px) to count as a grid step. */
  private static readonly SWIPE_THRESHOLD_PX = 28;

  constructor(bus: GameEventBus) {
    this.bus = bus;
  }

  /** Wire the HTML control panel (expects elements with `data-dir`). */
  bindDpad(container: HTMLElement): void {
    this.unbindDpad(container);

    this.dpadPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = (event.target as HTMLElement).closest(`[${DIR_ATTR}]`);
      if (!target || !container.contains(target)) return;
      const raw = target.getAttribute(DIR_ATTR);
      if (!raw || !isDirection(raw)) return;
      event.preventDefault();
      (target as HTMLElement).setPointerCapture(event.pointerId);
      this.beginHold(raw);
    };

    this.dpadPointerUp = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest(`[${DIR_ATTR}]`);
      if (target && (target as HTMLElement).hasPointerCapture(event.pointerId)) {
        (target as HTMLElement).releasePointerCapture(event.pointerId);
      }
      if (this.dpadHoldDirection) {
        this.endHold();
      }
    };

    container.addEventListener("pointerdown", this.dpadPointerDown);
    container.addEventListener("pointerup", this.dpadPointerUp);
    container.addEventListener("pointercancel", this.dpadPointerUp);
    container.addEventListener("lostpointercapture", this.dpadPointerUp);
  }

  unbindDpad(container: HTMLElement): void {
    if (this.dpadPointerDown) {
      container.removeEventListener("pointerdown", this.dpadPointerDown);
      this.dpadPointerDown = null;
    }
    if (this.dpadPointerUp) {
      container.removeEventListener("pointerup", this.dpadPointerUp);
      container.removeEventListener("pointercancel", this.dpadPointerUp);
      container.removeEventListener("lostpointercapture", this.dpadPointerUp);
      this.dpadPointerUp = null;
    }
    if (this.dpadHoldDirection) {
      this.endHold();
    }
  }

  /**
   * One-step swipe on the playfield (phones / tablets).
   * Does not repeat while held — use D-pad hold for continuous movement.
   */
  bindSwipe(target: HTMLElement): void {
    this.unbindSwipe(target);

    this.swipeTarget = target;
    this.swipePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      this.swipePointerId = event.pointerId;
      this.swipeStartX = event.clientX;
      this.swipeStartY = event.clientY;
    };

    this.swipePointerUp = (event: PointerEvent) => {
      if (this.swipePointerId !== event.pointerId) return;
      this.swipePointerId = null;
      const dx = event.clientX - this.swipeStartX;
      const dy = event.clientY - this.swipeStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < DirectionInput.SWIPE_THRESHOLD_PX) {
        return;
      }
      if (absX >= absY) {
        this.bus.emitDirection(dx > 0 ? "right" : "left");
      } else {
        this.bus.emitDirection(dy > 0 ? "down" : "up");
      }
    };

    target.addEventListener("pointerdown", this.swipePointerDown);
    target.addEventListener("pointerup", this.swipePointerUp);
    target.addEventListener("pointercancel", this.swipePointerUp);
  }

  unbindSwipe(target: HTMLElement): void {
    if (this.swipePointerDown) {
      target.removeEventListener("pointerdown", this.swipePointerDown);
      this.swipePointerDown = null;
    }
    if (this.swipePointerUp) {
      target.removeEventListener("pointerup", this.swipePointerUp);
      target.removeEventListener("pointercancel", this.swipePointerUp);
      this.swipePointerUp = null;
    }
    if (this.swipeTarget === target) {
      this.swipeTarget = null;
      this.swipePointerId = null;
    }
  }

  /** Desktop / hardware keyboard: Arrow keys and WASD. */
  bindKeyboard(): void {
    if (this.keyDownListener) return;

    this.keyDownListener = (event: KeyboardEvent) => {
      const direction = directionForKey(event.key);
      if (!direction) return;
      event.preventDefault();

      // OS auto-repeat accelerates; we drive hold-to-move only via repeatTimer.
      if (event.repeat) return;

      if (this.heldKeys.includes(event.key)) return;

      this.heldKeys.push(event.key);
      this.syncActiveDirection();
      this.emitStep();
      this.ensureRepeatTimer();
    };

    this.keyUpListener = (event: KeyboardEvent) => {
      const direction = directionForKey(event.key);
      if (!direction) return;

      const index = this.heldKeys.indexOf(event.key);
      if (index >= 0) {
        this.heldKeys.splice(index, 1);
      }
      this.syncActiveDirection();
      if (this.heldKeys.length === 0) {
        this.stopRepeatTimer();
      }
      this.emitReleaseIfIdle();
    };

    this.blurListener = () => this.releaseAllKeys();

    window.addEventListener("keydown", this.keyDownListener);
    window.addEventListener("keyup", this.keyUpListener);
    window.addEventListener("blur", this.blurListener);
  }

  dispose(): void {
    this.releaseAllKeys();
    if (this.swipeTarget) {
      this.unbindSwipe(this.swipeTarget);
    }
    if (this.keyDownListener) {
      window.removeEventListener("keydown", this.keyDownListener);
      this.keyDownListener = null;
    }
    if (this.keyUpListener) {
      window.removeEventListener("keyup", this.keyUpListener);
      this.keyUpListener = null;
    }
    if (this.blurListener) {
      window.removeEventListener("blur", this.blurListener);
      this.blurListener = null;
    }
  }

  private beginHold(direction: Direction): void {
    this.endHold();
    this.dpadHoldDirection = direction;
    this.activeDirection = direction;
    this.emitStep();
    this.ensureRepeatTimer();
  }

  private endHold(): void {
    this.dpadHoldDirection = null;
    if (this.heldKeys.length === 0) {
      this.activeDirection = null;
      this.stopRepeatTimer();
    } else {
      this.syncActiveDirection();
    }
    this.emitReleaseIfIdle();
  }

  private syncActiveDirection(): void {
    for (let i = this.heldKeys.length - 1; i >= 0; i--) {
      const direction = directionForKey(this.heldKeys[i]!);
      if (direction) {
        this.activeDirection = direction;
        return;
      }
    }
    this.activeDirection = this.dpadHoldDirection;
  }

  private emitStep(): void {
    if (!this.activeDirection) return;
    this.bus.emitDirection(this.activeDirection);
  }

  private ensureRepeatTimer(): void {
    if (this.repeatTimer != null) return;
    this.repeatTimer = setInterval(() => this.emitStep(), REPEAT_INTERVAL_MS);
  }

  private stopRepeatTimer(): void {
    if (this.repeatTimer != null) {
      clearInterval(this.repeatTimer);
      this.repeatTimer = null;
    }
  }

  private releaseAllKeys(): void {
    this.heldKeys.length = 0;
    this.dpadHoldDirection = null;
    this.activeDirection = null;
    this.stopRepeatTimer();
    this.emitReleaseIfIdle();
  }

  private emitReleaseIfIdle(): void {
    if (!this.activeDirection) {
      this.bus.emitDirectionRelease();
    }
  }

  /** Whether a direction key or d-pad hold is currently active. */
  hasActiveDirection(): boolean {
    return this.activeDirection != null;
  }

  /** Held direction for force-floor combine while a key or d-pad is active. */
  getActiveDirection(): Direction | null {
    return this.activeDirection;
  }
}
