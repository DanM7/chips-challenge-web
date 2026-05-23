import type { DirectionInput } from "@engine/DirectionInput";

import type { GameEventBus } from "@engine/GameEventBus";

import type Phaser from "phaser";

import {

  isControlsOnLeft,

  isJoystickMode,

  isPortraitViewport,

  loadTouchControlMode,

  prefersTouchLayout,

  saveTouchControlMode,

  type TouchControlMode,

} from "./controlMode";

import {
  applyDpadPreferences,
  clearDpadPreferenceVars,
  loadDpadButtonSize,
  loadDpadButtonSpacing,
  saveDpadButtonSize,
  saveDpadButtonSpacing,
  type DpadButtonSize,
  type DpadButtonSpacing,
} from "./dpadPreferences";

import { clearMobileHeaderBand, updateMobileHeaderBand } from "./mobileHeaderBand";

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

  getDpadButtonSize(): DpadButtonSize;

  setDpadButtonSize(size: DpadButtonSize): void;

  getDpadButtonSpacing(): DpadButtonSpacing;

  setDpadButtonSpacing(spacing: DpadButtonSpacing): void;

  refresh(): void;

}



const TOUCH_LAYOUT_MQ = "(hover: none), (pointer: coarse), (max-width: 720px)";

const PORTRAIT_LAYOUT_MQ = "(orientation: portrait), (max-aspect-ratio: 1/1)";



export function createTouchControls(

  input: DirectionInput,

  bus: GameEventBus,

  game: Phaser.Game,

  elements: TouchControlsElements,

): TouchControlsHandle {

  let mode = loadTouchControlMode();

  let dpadButtonSize = loadDpadButtonSize();

  let dpadButtonSpacing = loadDpadButtonSpacing();

  let joystickDispose: (() => void) | null = null;

  let layoutRaf = 0;

  let bandObserver: ResizeObserver | null = null;



  const touchLayoutMq = window.matchMedia(TOUCH_LAYOUT_MQ);

  const portraitLayoutMq = window.matchMedia(PORTRAIT_LAYOUT_MQ);



  const scheduleLayoutRefresh = (): void => {

    if (layoutRaf) {

      cancelAnimationFrame(layoutRaf);

    }

    layoutRaf = requestAnimationFrame(() => {

      layoutRaf = 0;

      apply();

      game.events.emit("pixel-zoom-changed");

    });

  };



  function ensureBandObserver(): void {

    const gameEl = document.getElementById("game-container");

    if (!gameEl) {

      return;

    }

    bandObserver?.disconnect();

    bandObserver = new ResizeObserver(() => scheduleLayoutRefresh());

    bandObserver.observe(gameEl);

    const stage = gameEl.parentElement;

    if (stage) {

      bandObserver.observe(stage);

    }

  }



  function unbindJoystick(): void {

    if (joystickDispose) {

      joystickDispose();

      joystickDispose = null;

    }

  }



  function apply(): void {

    const showStrip = prefersTouchLayout();

    const portrait = showStrip && isPortraitViewport();

    const landscapeSide = showStrip && !portrait;

    const useJoystick = isJoystickMode(mode);

    const onLeft = isControlsOnLeft(mode);



    elements.playRow.classList.toggle("play-row--touch-active", showStrip);

    elements.playRow.classList.toggle("play-row--portrait", portrait);

    elements.playRow.classList.toggle("play-row--landscape", landscapeSide);

    elements.playRow.classList.toggle(

      "play-row--controls-left",

      landscapeSide && onLeft,

    );

    elements.touchControls.hidden = !showStrip;

    if (showStrip) {
      applyDpadPreferences(
        elements.playRow,
        { landscape: landscapeSide },
        dpadButtonSize,
        dpadButtonSpacing,
      );
    } else {
      clearDpadPreferenceVars(elements.playRow);
    }



    elements.dpad.hidden = !showStrip || useJoystick;

    const joystickRoot = elements.joystickBase.closest<HTMLElement>(".joystick");

    if (joystickRoot) {

      joystickRoot.hidden = !showStrip || !useJoystick;

    }



    input.unbindDpad(elements.dpad);

    unbindJoystick();



    if (!showStrip) {

      bandObserver?.disconnect();

      bandObserver = null;

      clearMobileHeaderBand(elements.playRow);

      return;

    }



    if (useJoystick) {

      joystickDispose = bindTouchJoystick(elements.joystickBase, elements.joystickKnob, bus);

    } else {

      input.bindDpad(elements.dpad);

    }



    if (landscapeSide) {

      ensureBandObserver();

      updateMobileHeaderBand(elements.playRow, mode, true);

    } else {

      bandObserver?.disconnect();

      bandObserver = null;

      clearMobileHeaderBand(elements.playRow);

    }

  }



  touchLayoutMq.addEventListener("change", scheduleLayoutRefresh);

  portraitLayoutMq.addEventListener("change", scheduleLayoutRefresh);

  window.addEventListener("resize", scheduleLayoutRefresh);

  window.addEventListener("orientationchange", scheduleLayoutRefresh);

  window.visualViewport?.addEventListener("resize", scheduleLayoutRefresh);

  game.events.on("pixel-zoom-changed", () => {

    if (elements.playRow.classList.contains("play-row--landscape")) {

      updateMobileHeaderBand(elements.playRow, mode, true);

    }

  });



  apply();



  return {

    getMode: () => mode,

    setMode(next: TouchControlMode) {

      mode = next;

      saveTouchControlMode(next);

      apply();

      game.events.emit("pixel-zoom-changed");

    },

    getDpadButtonSize: () => dpadButtonSize,

    setDpadButtonSize(next: DpadButtonSize) {
      dpadButtonSize = next;
      saveDpadButtonSize(next);
      apply();
    },

    getDpadButtonSpacing: () => dpadButtonSpacing,

    setDpadButtonSpacing(next: DpadButtonSpacing) {
      dpadButtonSpacing = next;
      saveDpadButtonSpacing(next);
      apply();
    },

    refresh: apply,

  };

}

