import type Phaser from "phaser";

const MIN_LEVEL = 1;
const MAX_LEVEL = 150;
const GO_TO_LEVEL_EVENT = "go-to-level";

/** Gear menu, dropdown sections, and level-select modal in the app header. */
export function bindAppHeaderMenu(game: Phaser.Game): void {
  const trigger = document.getElementById("app-menu-trigger");
  const dropdown = document.getElementById("app-menu-dropdown");
  const levelSelectOpen = document.getElementById("level-select-open");
  const modal = document.getElementById("level-select-modal");
  const input = document.getElementById("level-select-input") as HTMLInputElement | null;
  const goBtn = document.getElementById("level-select-go");
  const cancelBtn = document.getElementById("level-select-cancel");

  if (
    !trigger ||
    !dropdown ||
    !levelSelectOpen ||
    !modal ||
    !input ||
    !goBtn ||
    !cancelBtn
  ) {
    return;
  }

  const closeDropdown = (): void => {
    dropdown.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };

  const openDropdown = (): void => {
    dropdown.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  };

  const toggleDropdown = (): void => {
    if (dropdown.hidden) {
      openDropdown();
    } else {
      closeDropdown();
    }
  };

  const openLevelModal = (): void => {
    closeDropdown();
    modal.hidden = false;
    input.value = String(MIN_LEVEL);
    input.focus();
    input.select();
  };

  const closeLevelModal = (): void => {
    modal.hidden = true;
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
  };

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleDropdown();
  });

  levelSelectOpen.addEventListener("click", () => {
    openLevelModal();
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

  document.addEventListener("click", (event) => {
    const target = event.target as Node;
    if (!dropdown.hidden && !dropdown.contains(target) && !trigger.contains(target)) {
      closeDropdown();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeLevelModal();
    }
  });
}

export { GO_TO_LEVEL_EVENT, MAX_LEVEL, MIN_LEVEL };
