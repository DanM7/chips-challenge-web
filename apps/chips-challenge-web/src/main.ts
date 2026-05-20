import "./style.css";
import { GameEngine } from "@engine/GameEngine";
import { GameEventBus } from "@engine/GameEventBus";
import { DirectionInput } from "@engine/DirectionInput";
import {
  loadGameManifest,
  loadLevelsIndex,
  loadOriginalLevelReference,
} from "@engine/ConfigLoader";
import {
  resolveDefaultLaunchLevelNumber,
  resolveLevelNumberFromPassword,
} from "@engine/levelPassword";
import { PlayScene } from "./scenes/PlayScene";
import { bindAppHeaderMenu } from "./ui/AppHeaderMenu";
import Phaser from "phaser";
import { bumpPixelZoom, getPixelZoom } from "@engine/pixelZoom";
const MANIFEST_URL = "/games/chips-challenge-1/manifest.json";

async function bootstrap(): Promise<void> {
  const manifest = await loadGameManifest(MANIFEST_URL);

  const titleEl = document.querySelector<HTMLElement>(".app-title");
  if (titleEl) {
    titleEl.textContent = manifest.title;
  }

  const levelsIndex = manifest.levelsIndexUrl
    ? await loadLevelsIndex(manifest.levelsIndexUrl)
    : null;
  const defaultLevelNumber = resolveDefaultLaunchLevelNumber(levelsIndex);

  const bus = new GameEventBus();
  const input = new DirectionInput(bus);

  const dpad = document.querySelector<HTMLElement>(".dpad:not(.u-hidden)");
  if (dpad && !dpad.hasAttribute("hidden")) {
    input.bindDpad(dpad);
  }

  input.bindKeyboard();

  const launchLevelNumber =
    (await resolveLevelFromQueryPassword(manifest)) ?? defaultLevelNumber;

  const engine = new GameEngine();
  const game = engine.start(
    { ...manifest, launchLevelNumber },
    bus,
    {
      parentId: "game-container",
      sceneMap: {
        Play: PlayScene,
      },
    },
  );

  bindAppHeaderMenu(game);

  const zoomControls = document.querySelector(".zoom-controls:not(.u-hidden)");
  if (zoomControls && !zoomControls.hasAttribute("hidden")) {
    bindZoomControls(game);
  }

  requestAnimationFrame(() => {
    game.events.emit("pixel-zoom-changed");
  });
}

function bindZoomControls(game: Phaser.Game): void {
  const label = document.getElementById("zoom-label");
  const updateLabel = (): void => {
    if (label) {
      label.textContent = `${getPixelZoom(game)}×`;
    }
  };

  document.getElementById("zoom-in")?.addEventListener("click", () => {
    bumpPixelZoom(game, 1);
  });
  document.getElementById("zoom-out")?.addEventListener("click", () => {
    bumpPixelZoom(game, -1);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") {
      bumpPixelZoom(game, 1);
    } else if (event.key === "-") {
      bumpPixelZoom(game, -1);
    }
  });

  game.events.on("pixel-zoom-changed", updateLabel);
  updateLabel();
}

/** `?password=XXXX` overrides; otherwise bootstrap uses `levels/index.json` default. */
async function resolveLevelFromQueryPassword(
  manifest: Awaited<ReturnType<typeof loadGameManifest>>,
): Promise<number | null> {
  const password = new URLSearchParams(window.location.search).get("password")?.trim();
  if (!password) {
    return null;
  }
  const refUrl = manifest.originalLevelReferenceUrl;
  if (!refUrl) {
    console.warn("?password= is set but manifest has no originalLevelReferenceUrl.");
    return null;
  }
  const doc = await loadOriginalLevelReference(refUrl);
  const levelNum = resolveLevelNumberFromPassword(doc, password);
  if (levelNum == null) {
    console.warn(`Unknown level password: ${password}`);
  }
  return levelNum;
}

void bootstrap().catch((error) => {
  console.error(error);
  const container = document.getElementById("game-container");
  if (container) {
    container.textContent =
      error instanceof Error ? error.message : "Failed to start game.";
  }
});
