import type Phaser from "phaser";
import type { RunState } from "@engine/types";

/** MS inventory key slots (matches MsWindowHud). */
const DEBUG_KEY_IDS = [
  "key_red",
  "key_blue",
  "key_yellow",
  "key_green",
] as const;

/** MS inventory tool slots (matches MsWindowHud). */
const DEBUG_TOOL_IDS = [
  "ice_skates",
  "suction_boots",
  "fire_boots",
  "flippers",
] as const;

export const DEBUG_INVENTORY_EVENT = "debug-inventory-changed";

export interface DebugInventoryState {
  keys: string[];
  tools: string[];
  chipsRemainingOnMap: number;
}

/** True when served from localhost (local debugging only). */
export function isLocalhostDebugHost(): boolean {
  return window.location.hostname === "localhost";
}

function runStateToDebug(state: RunState): DebugInventoryState {
  return {
    keys: [...(state.inventory?.keys ?? [])],
    tools: [...(state.inventory?.tools ?? [])],
    chipsRemainingOnMap: state.collectiblesLeftCount,
  };
}

/** Debug nav + page; inventory toggles and chips stepper (localhost only). */
export function bindDebugPanel(game: Phaser.Game): void {
  const nav = document.getElementById("settings-nav-debug");
  const page = document.getElementById("settings-page-debug");
  const chipsValue = document.getElementById("debug-chips-value");
  const chipsDec = document.getElementById("debug-chips-dec");
  const chipsInc = document.getElementById("debug-chips-inc");

  if (!nav || !page || !chipsValue || !chipsDec || !chipsInc) {
    return;
  }

  if (!isLocalhostDebugHost()) {
    nav.remove();
    page.remove();
    return;
  }

  nav.hidden = false;

  const keyButtons = new Map<string, HTMLButtonElement>();
  const toolButtons = new Map<string, HTMLButtonElement>();

  for (const keyId of DEBUG_KEY_IDS) {
    const btn = page.querySelector<HTMLButtonElement>(
      `[data-debug-key="${keyId}"]`,
    );
    if (btn) {
      keyButtons.set(keyId, btn);
    }
  }

  for (const toolId of DEBUG_TOOL_IDS) {
    const btn = page.querySelector<HTMLButtonElement>(
      `[data-debug-tool="${toolId}"]`,
    );
    if (btn) {
      toolButtons.set(toolId, btn);
    }
  }

  let chipsRemaining = 0;

  const setChipsDisplay = (value: number): void => {
    chipsRemaining = Math.max(0, value);
    chipsValue.textContent = String(chipsRemaining);
  };

  const applyUiToGame = (): void => {
    const keys: string[] = [];
    for (const [id, btn] of keyButtons) {
      if (btn.getAttribute("aria-checked") === "true") {
        keys.push(id);
      }
    }
    const tools: string[] = [];
    for (const [id, btn] of toolButtons) {
      if (btn.getAttribute("aria-checked") === "true") {
        tools.push(id);
      }
    }
    const payload: DebugInventoryState = {
      keys,
      tools,
      chipsRemainingOnMap: chipsRemaining,
    };
    game.events.emit(DEBUG_INVENTORY_EVENT, payload);
  };

  const syncFromRunState = (state: RunState): void => {
    const debug = runStateToDebug(state);
    for (const [id, btn] of keyButtons) {
      const held = debug.keys.includes(id);
      btn.setAttribute("aria-checked", held ? "true" : "false");
    }
    for (const [id, btn] of toolButtons) {
      const held = debug.tools.includes(id);
      btn.setAttribute("aria-checked", held ? "true" : "false");
    }
    setChipsDisplay(debug.chipsRemainingOnMap);
  };

  const toggleCheckbox = (btn: HTMLButtonElement): void => {
    const checked = btn.getAttribute("aria-checked") === "true";
    btn.setAttribute("aria-checked", checked ? "false" : "true");
    applyUiToGame();
  };

  for (const btn of keyButtons.values()) {
    btn.addEventListener("click", () => toggleCheckbox(btn));
  }
  for (const btn of toolButtons.values()) {
    btn.addEventListener("click", () => toggleCheckbox(btn));
  }

  chipsDec.addEventListener("click", () => {
    setChipsDisplay(chipsRemaining - 1);
    applyUiToGame();
  });

  chipsInc.addEventListener("click", () => {
    setChipsDisplay(chipsRemaining + 1);
    applyUiToGame();
  });

  game.events.on("run-state", syncFromRunState);
}
