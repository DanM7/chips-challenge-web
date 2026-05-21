import type { Direction } from "@engine/types";
import type { GameEventBus } from "@engine/GameEventBus";
import { MS_CHIP_WALK_STEP_MS } from "@engine/msCc1/msCc1Monsters";

const REPEAT_INTERVAL_MS = MS_CHIP_WALK_STEP_MS;

/** Map stick deflection to a cardinal direction (8-way stick, 4-way game). */
export function directionFromStickDeflection(dx: number, dy: number, deadZone: number): Direction | null {
  const len = Math.hypot(dx, dy);
  if (len < deadZone) {
    return null;
  }
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= ay) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

/**
 * Circular virtual joystick — hold outside dead zone repeats grid steps like the D-pad.
 */
export function bindTouchJoystick(
  base: HTMLElement,
  knob: HTMLElement,
  bus: GameEventBus,
): () => void {
  let activePointerId: number | null = null;
  let activeDirection: Direction | null = null;
  let repeatTimer: ReturnType<typeof setInterval> | null = null;

  const center = (): { x: number; y: number } => {
    const rect = base.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const deadZonePx = (): number => Math.max(14, base.clientWidth * 0.14);
  const knobTravelPx = (): number => Math.max(28, base.clientWidth * 0.32);

  const stopRepeat = (): void => {
    if (repeatTimer != null) {
      clearInterval(repeatTimer);
      repeatTimer = null;
    }
  };

  const emitStep = (): void => {
    if (activeDirection) {
      bus.emitDirection(activeDirection);
    }
  };

  const ensureRepeat = (): void => {
    if (repeatTimer != null) return;
    repeatTimer = setInterval(() => emitStep(), REPEAT_INTERVAL_MS);
  };

  const resetKnob = (): void => {
    knob.style.transform = "translate(-50%, -50%)";
  };

  const setDirection = (direction: Direction | null): void => {
    if (direction === activeDirection) return;
    activeDirection = direction;
    if (!direction) {
      stopRepeat();
      return;
    }
    emitStep();
    ensureRepeat();
  };

  const updateFromPointer = (clientX: number, clientY: number): void => {
    const c = center();
    const dx = clientX - c.x;
    const dy = clientY - c.y;
    const direction = directionFromStickDeflection(dx, dy, deadZonePx());
    setDirection(direction);

    if (!direction) {
      resetKnob();
      return;
    }

    const travel = knobTravelPx();
    const len = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, travel / len);
    const offsetX = dx * scale;
    const offsetY = dy * scale;
    knob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || activePointerId != null) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    base.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (activePointerId !== event.pointerId) return;
    event.preventDefault();
    updateFromPointer(event.clientX, event.clientY);
  };

  const endPointer = (event: PointerEvent): void => {
    if (activePointerId !== event.pointerId) return;
    if (base.hasPointerCapture(event.pointerId)) {
      base.releasePointerCapture(event.pointerId);
    }
    activePointerId = null;
    setDirection(null);
    resetKnob();
  };

  base.addEventListener("pointerdown", onPointerDown);
  base.addEventListener("pointermove", onPointerMove);
  base.addEventListener("pointerup", endPointer);
  base.addEventListener("pointercancel", endPointer);
  base.addEventListener("lostpointercapture", endPointer);

  return () => {
    base.removeEventListener("pointerdown", onPointerDown);
    base.removeEventListener("pointermove", onPointerMove);
    base.removeEventListener("pointerup", endPointer);
    base.removeEventListener("pointercancel", endPointer);
    base.removeEventListener("lostpointercapture", endPointer);
    activePointerId = null;
    setDirection(null);
    resetKnob();
  };
}
