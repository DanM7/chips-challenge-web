import type Phaser from "phaser";
import { isTouchControlMode, type TouchControlMode } from "./controlMode";
import { isDpadButtonSize, isDpadButtonSpacing } from "./dpadPreferences";
import {
  isSoundToggle,
  loadMusicEnabled,
  loadSoundEffectsEnabled,
  saveMusicEnabled,
  saveSoundEffectsEnabled,
} from "./soundPreferences";
import {
  isGameSelectAvailable,
  isGameSelectId,
  loadSelectedGameId,
  saveSelectedGameId,
  type GameSelectId,
} from "./gameSelect";
import { bindDebugPanel } from "./debugPanel";
import { updateSettingsPanelLayout } from "./settingsPanelLayout";
import type { TouchControlsHandle } from "./touchControls";
import { playBummerSfx } from "./uiSfx";

const MIN_LEVEL = 1;
const MAX_LEVEL = 150;
const GO_TO_LEVEL_EVENT = "go-to-level";
const RESTART_LEVEL_EVENT = "restart-level";
const AUTO_PLAY_LEVEL_EVENT = "auto-play-level";

type SettingsSection = "game" | "alignment" | "buttons" | "sound" | "about" | "debug";

export interface AppHeaderMenuOptions {
  touchControls?: TouchControlsHandle;
}

/** Gear button, VS-style settings panel, and level-select modal. */
export function bindAppHeaderMenu(game: Phaser.Game, options: AppHeaderMenuOptions = {}): void {
  const trigger = document.getElementById("app-menu-trigger");
  const settingsPanel = document.getElementById("settings-panel");
  const settingsClose = document.getElementById("settings-panel-close");
  const playRow = document.getElementById("play-row");
  const newGameOpen = document.getElementById("new-game-open");
  const newGameConfirmModal = document.getElementById("new-game-confirm-modal");
  const newGameConfirmYes = document.getElementById("new-game-confirm-yes");
  const newGameConfirmNo = document.getElementById("new-game-confirm-no");
  const restartLevel = document.getElementById("restart-level");
  const autoPlayLevel = document.getElementById("auto-play-level");
  const levelSelectOpen = document.getElementById("level-select-open");
  const modal = document.getElementById("level-select-modal");
  const input = document.getElementById("level-select-input") as HTMLInputElement | null;
  const goBtn = document.getElementById("level-select-go");
  const cancelBtn = document.getElementById("level-select-cancel");
  const comingSoonModal = document.getElementById("coming-soon-modal");
  const comingSoonOk = document.getElementById("coming-soon-ok");

  if (
    !trigger ||
    !settingsPanel ||
    !settingsClose ||
    !newGameOpen ||
    !newGameConfirmModal ||
    !newGameConfirmYes ||
    !newGameConfirmNo ||
    !restartLevel ||
    !autoPlayLevel ||
    !levelSelectOpen ||
    !modal ||
    !input ||
    !goBtn ||
    !cancelBtn ||
    !comingSoonModal ||
    !comingSoonOk
  ) {
    return;
  }

  const navItems = Array.from(
    settingsPanel.querySelectorAll<HTMLButtonElement>("[data-settings-section]"),
  );
  const pages = Array.from(
    settingsPanel.querySelectorAll<HTMLElement>("[data-settings-page]"),
  );

  let layoutObserver: ResizeObserver | null = null;
  let activeSection: SettingsSection = "game";

  const syncPanelLayout = (): void => {
    if (settingsPanel.hidden) {
      return;
    }
    updateSettingsPanelLayout(settingsPanel, playRow);
  };

  const ensureLayoutObserver = (): void => {
    if (layoutObserver || !playRow) {
      return;
    }
    layoutObserver = new ResizeObserver(() => syncPanelLayout());
    layoutObserver.observe(playRow);
    const stage = playRow.querySelector(".play-stage");
    const rail = playRow.querySelector(".control-rail");
    if (stage) {
      layoutObserver.observe(stage);
    }
    if (rail) {
      layoutObserver.observe(rail);
    }
    window.addEventListener("resize", syncPanelLayout);
    window.addEventListener("orientationchange", syncPanelLayout);
    window.visualViewport?.addEventListener("resize", syncPanelLayout);
  };

  const showSection = (section: SettingsSection): void => {
    activeSection = section;
    for (const nav of navItems) {
      const id = nav.getAttribute("data-settings-section") as SettingsSection;
      if (id === section) {
        nav.setAttribute("aria-current", "page");
      } else {
        nav.removeAttribute("aria-current");
      }
    }
    for (const page of pages) {
      const id = page.getAttribute("data-settings-page");
      page.hidden = id !== section;
    }
  };

  const closeSettings = (): void => {
    settingsPanel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };

  const openSettings = (): void => {
    showSection(activeSection);
    settingsPanel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    ensureLayoutObserver();
    syncPanelLayout();
  };

  const toggleSettings = (): void => {
    if (settingsPanel.hidden) {
      openSettings();
    } else {
      closeSettings();
    }
  };

  const openNewGameConfirm = (): void => {
    newGameConfirmModal.hidden = false;
    newGameConfirmYes.focus();
  };

  const closeNewGameConfirm = (): void => {
    newGameConfirmModal.hidden = true;
  };

  const confirmNewGame = (): void => {
    closeNewGameConfirm();
    closeSettings();
    game.events.emit(GO_TO_LEVEL_EVENT, MIN_LEVEL);
  };

  const openLevelModal = (): void => {
    modal.hidden = false;
    input.value = String(MIN_LEVEL);
    input.focus();
    input.select();
  };

  const closeLevelModal = (): void => {
    modal.hidden = true;
  };

  const openComingSoonModal = (): void => {
    comingSoonModal.hidden = false;
    comingSoonOk.focus();
  };

  const closeComingSoonModal = (): void => {
    comingSoonModal.hidden = true;
  };

  const showComingSoonForGame = (): void => {
    playBummerSfx();
    openComingSoonModal();
  };

  const submitLevel = (): void => {
    const parsed = Number.parseInt(input.value, 10);
    if (!Number.isFinite(parsed) || parsed < MIN_LEVEL || parsed > MAX_LEVEL) {
      input.setCustomValidity(`Enter a level from ${MIN_LEVEL} to ${MAX_LEVEL}.`);
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    game.events.emit(GO_TO_LEVEL_EVENT, parsed);
    closeLevelModal();
    closeSettings();
  };

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettings();
  });

  settingsClose.addEventListener("click", () => {
    closeSettings();
    trigger.focus();
  });

  for (const nav of navItems) {
    nav.addEventListener("click", () => {
      const section = nav.getAttribute("data-settings-section") as SettingsSection;
      if (section) {
        showSection(section);
      }
    });
  }

  newGameOpen.addEventListener("click", () => {
    openNewGameConfirm();
  });

  newGameConfirmYes.addEventListener("click", () => {
    confirmNewGame();
  });

  newGameConfirmNo.addEventListener("click", () => {
    closeNewGameConfirm();
  });

  newGameConfirmModal.addEventListener("click", (event) => {
    if (event.target === newGameConfirmModal) {
      closeNewGameConfirm();
    }
  });

  levelSelectOpen.addEventListener("click", () => {
    openLevelModal();
  });

  restartLevel.addEventListener("click", () => {
    closeSettings();
    game.events.emit(RESTART_LEVEL_EVENT);
  });

  autoPlayLevel.addEventListener("click", () => {
    closeSettings();
    game.events.emit(AUTO_PLAY_LEVEL_EVENT);
  });

  for (const link of Array.from(
    settingsPanel.querySelectorAll<HTMLAnchorElement>(".settings-option--link"),
  )) {
    link.addEventListener("click", () => {
      closeSettings();
    });
  }

  const syncRadios = (selector: string, active: string, attr: string): void => {
    for (const btn of Array.from(
      settingsPanel.querySelectorAll<HTMLButtonElement>(selector),
    )) {
      const value = btn.getAttribute(attr);
      btn.setAttribute("aria-checked", value === active ? "true" : "false");
    }
  };

  const controlRadios = Array.from(
    settingsPanel.querySelectorAll<HTMLButtonElement>("[data-control-mode]"),
  );

  if (options.touchControls && controlRadios.length > 0) {
    syncRadios("[data-control-mode]", options.touchControls.getMode(), "data-control-mode");
    for (const btn of controlRadios) {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-control-mode");
        if (!raw || !isTouchControlMode(raw)) return;
        options.touchControls!.setMode(raw);
        syncRadios("[data-control-mode]", raw, "data-control-mode");
        syncPanelLayout();
      });
    }
  }

  const dpadSizeRadios = Array.from(
    settingsPanel.querySelectorAll<HTMLButtonElement>("[data-dpad-size]"),
  );
  const dpadSpacingRadios = Array.from(
    settingsPanel.querySelectorAll<HTMLButtonElement>("[data-dpad-spacing]"),
  );

  if (options.touchControls && dpadSizeRadios.length > 0) {
    syncRadios(
      "[data-dpad-size]",
      options.touchControls.getDpadButtonSize(),
      "data-dpad-size",
    );
    for (const btn of dpadSizeRadios) {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-dpad-size");
        if (!raw || !isDpadButtonSize(raw)) return;
        options.touchControls!.setDpadButtonSize(raw);
        syncRadios("[data-dpad-size]", raw, "data-dpad-size");
      });
    }
  }

  if (options.touchControls && dpadSpacingRadios.length > 0) {
    syncRadios(
      "[data-dpad-spacing]",
      options.touchControls.getDpadButtonSpacing(),
      "data-dpad-spacing",
    );
    for (const btn of dpadSpacingRadios) {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-dpad-spacing");
        if (!raw || !isDpadButtonSpacing(raw)) return;
        options.touchControls!.setDpadButtonSpacing(raw);
        syncRadios("[data-dpad-spacing]", raw, "data-dpad-spacing");
      });
    }
  }

  const musicRadios = Array.from(
    settingsPanel.querySelectorAll<HTMLButtonElement>("[data-music-enabled]"),
  );
  if (musicRadios.length > 0) {
    syncRadios("[data-music-enabled]", loadMusicEnabled(), "data-music-enabled");
    for (const btn of musicRadios) {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-music-enabled");
        if (!raw || !isSoundToggle(raw)) return;
        saveMusicEnabled(raw);
        syncRadios("[data-music-enabled]", raw, "data-music-enabled");
      });
    }
  }

  const sfxRadios = Array.from(
    settingsPanel.querySelectorAll<HTMLButtonElement>("[data-sound-effects-enabled]"),
  );
  if (sfxRadios.length > 0) {
    syncRadios(
      "[data-sound-effects-enabled]",
      loadSoundEffectsEnabled(),
      "data-sound-effects-enabled",
    );
    for (const btn of sfxRadios) {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-sound-effects-enabled");
        if (!raw || !isSoundToggle(raw)) return;
        saveSoundEffectsEnabled(raw);
        syncRadios("[data-sound-effects-enabled]", raw, "data-sound-effects-enabled");
      });
    }
  }

  const gameSelectRadios = Array.from(
    settingsPanel.querySelectorAll<HTMLButtonElement>("[data-game-select]"),
  );
  const syncGameSelect = (active: GameSelectId): void => {
    syncRadios("[data-game-select]", active, "data-game-select");
  };
  if (gameSelectRadios.length > 0) {
    syncGameSelect(loadSelectedGameId());
    for (const btn of gameSelectRadios) {
      btn.addEventListener("click", () => {
        const raw = btn.getAttribute("data-game-select");
        if (!raw || !isGameSelectId(raw)) return;
        if (!isGameSelectAvailable(raw)) {
          showComingSoonForGame();
          syncGameSelect(loadSelectedGameId());
          return;
        }
        saveSelectedGameId(raw);
        syncGameSelect(raw);
      });
    }
  }

  comingSoonOk.addEventListener("click", () => {
    closeComingSoonModal();
  });

  comingSoonModal.addEventListener("click", (event) => {
    if (event.target === comingSoonModal) {
      closeComingSoonModal();
    }
  });

  goBtn.addEventListener("click", () => {
    submitLevel();
  });

  cancelBtn.addEventListener("click", () => {
    closeLevelModal();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitLevel();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeLevelModal();
    }
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeLevelModal();
    }
  });

  game.events.on("pixel-zoom-changed", syncPanelLayout);

  bindDebugPanel(game);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!comingSoonModal.hidden) {
        closeComingSoonModal();
      } else if (!newGameConfirmModal.hidden) {
        closeNewGameConfirm();
      } else if (!modal.hidden) {
        closeLevelModal();
      } else if (!settingsPanel.hidden) {
        closeSettings();
        trigger.focus();
      }
    }
  });
}

export {
  AUTO_PLAY_LEVEL_EVENT,
  GO_TO_LEVEL_EVENT,
  RESTART_LEVEL_EVENT,
  MAX_LEVEL,
  MIN_LEVEL,
};
