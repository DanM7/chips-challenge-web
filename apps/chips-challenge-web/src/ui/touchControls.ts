import type { DirectionInput } from "@engine/DirectionInput";
import type { GameEventBus } from "@engine/GameEventBus";
import type Phaser from "phaser";
import {
  isControlsOnLeft,
  isJoystickMode,
  loadTouchControlMode,
  prefersTouchLayout,
  saveTouchControlMode,
  type TouchControlMode,
} from "./controlMode";
import { bindTouchJoystick } from "./TouchJoystick";

export interface TouchControlsElements {
  playRow: HTMLElement;
  touchControls: HTMLElement;
  dpad: HTMLElement;
  joystickBase: HTMLElement;
  joystickKnob: HTMLElement;
}

export interface TouchControlsHandle {
  getMode(): TouchControlMode;
  setMode(mode: TouchControlMode): void;
  refresh(): void;
}

export function createTouchControls(
  input: DirectionInput,
  bus: GameEventBus,
  game: Phaser.Game,
  elements: TouchControlsElements,
): TouchControlsHandle {
  let mode = loadTouchControlMode();
  let joystickDispose: (() => void) | null = null;
  const layoutMq = window.matchMedia("(hover: none), (pointer: coarse), (max-width: 720px)");

  const onLayoutChange = (): void => {
    apply();
    game.events.emit("pixel-zoom-changed");
  };

  function unbindJoystick(): void {
    if (joystickDispose) {
      joystickDispose();
      joystickDispose = null;
    }
  }

  function apply(): void {
    const showStrip = prefersTouchLayout();
    const useJoystick = isJoystickMode(mode);
    const onLeft = isControlsOnLeft(mode);

    elements.playRow.classList.toggle("play-row--touch-active", showStrip);
    elements.playRow.classList.toggle("play-row--controls-left", showStrip && onLeft);
    elements.touchControls.hidden = !showStrip;

    elements.dpad.hidden = !showStrip || useJoystick;
    const joystickRoot = elements.joystickBase.closest<HTMLElement>(".joystick");
    if (joystickRoot) {
      joystickRoot.hidden = !showStrip || !useJoystick;
    }

    input.unbindDpad(elements.dpad);
    unbindJoystick();

    if (!showStrip) {
      return;
    }

    if (useJoystick) {
      joystickDispose = bindTouchJoystick(elements.joystickBase, elements.joystickKnob, bus);
    } else {
      input.bindDpad(elements.dpad);
    }
  }

  layoutMq.addEventListener("change", onLayoutChange);
  apply();

  return {
    getMode: () => mode,
    setMode(next: TouchControlMode) {
      mode = next;
      saveTouchControlMode(next);
      apply();
      game.events.emit("pixel-zoom-changed");
    },
    refresh: apply,
  };
}
