import Phaser from "phaser";

import type { Direction, GameManifest, LevelData, LevelsIndex } from "@engine/types";

import type { GameEventBus } from "@engine/GameEventBus";

import {
  loadAssetManifest,
  loadLevel,
  loadLevelsIndex,
} from "@engine/ConfigLoader";
import { buildMsFrameIndexByTileId } from "@engine/msTileFrames";

import { chipsLeftAtLevelStart } from "@engine/countCollectibles";

import { RunSession } from "@engine/RunSession";

import type { RunState } from "@engine/types";

import {
  cellTile,
  getCompositeTile,
  getLowerTileUnderMonster,
  isCloneMachineAt,
} from "@engine/levelRuntime";

import {
  applyButtonPressAt,
  collectRedButtonCells,
  type MsCc1ButtonPressContext,
} from "@engine/msCc1/msCc1Buttons";
import {
  createMsCc1Monsters,
  MS_CHIP_WALK_STEP_MS,
  MS_DEATH_CREATURES,
  MS_MOVE_INTERVAL_MS,
  tickMsCc1Monsters,
  type MsCc1MonsterState,
} from "@engine/msCc1/msCc1Monsters";
import {
  msCc1StateFromRun,
  tryMsCc1Move,
  type MsCc1MoveStep,
} from "@engine/msCc1/msCc1Movement";
import type { MsCc1MoveResult } from "@engine/msCc1/types";
import { getTerrainTileUnderChip } from "@engine/msCc1/msCc1Sliding";
import {
  compositeMsMaskedChipOnlyFromSheet,
  compositeMsMaskedFromSheet,
  MS_CHIP_WALK_OBJECT_CODE,
  msCreatureUsesMaskedSprite,
  msMaskedChipFrameTriple,
} from "@engine/msMaskedComposite";

import {
  CHIP_TILE_IDS,
  FLIPPERS_TILE_ID,
  isMonsterTile,
  objectCodeFromTileId,
} from "@tile-engine/tiles";

import { MS_TILE_SIZE } from "@tile-engine/msTileIndex";

import { applyIntegerDisplayZoom } from "@engine/pixelZoom";

import { MsWindowHud } from "../ui/MsWindowHud";
import { MsLevelIntroBanner } from "../ui/MsLevelIntroBanner";
import { MsOopsDialog } from "../ui/MsOopsDialog";
import { MsLevelCompleteDialog } from "../ui/MsLevelCompleteDialog";
import { buildMsLevelScoreBreakdown } from "@engine/msCc1/msCc1Scoring";
import { GO_TO_LEVEL_EVENT } from "../ui/AppHeaderMenu";
import {
  REGISTRY_PENDING_LEVEL_NUMBER,
  resolveDefaultLaunchLevelNumber,
} from "@engine/levelPassword";

import {

  loadMsWindowLayout,

  MS_WINDOW_TEXTURE,

  type MsWindowLayout,

} from "../ui/msWindowLayout";



const MS_TILES_KEY = "ms_tiles";



const CHIP_WALK_FRAME: Record<Direction, string> = {

  up: "chip_n",

  down: "chip_s",

  left: "chip_w",

  right: "chip_e",

};

const CHIP_SWIM_FRAME: Record<Direction, string> = {

  up: "chip_swim_n",

  down: "chip_swim_s",

  left: "chip_swim_w",

  right: "chip_swim_e",

};



export class PlayScene extends Phaser.Scene {

  private manifest!: GameManifest;

  private bus!: GameEventBus;

  private unsubscribeDirection: (() => void) | null = null;



  private levelsIndex: LevelsIndex | null = null;

  private currentLevelIndex = 0;

  private level: LevelData | null = null;

  private windowLayout: MsWindowLayout | null = null;

  private playerGx = 0;

  private playerGy = 0;

  private boardOriginX = 0;

  private boardOriginY = 0;

  private frameByTileId = new Map<string, number>();



  private msHud: MsWindowHud | null = null;

  private runSession: RunSession | null = null;

  private boardCam: Phaser.Cameras.Scene2D.Camera | null = null;

  private chip?: Phaser.GameObjects.Sprite;

  private tileLayer?: Phaser.GameObjects.Container;

  private readonly cellSprites = new Map<string, Phaser.GameObjects.Sprite>();
  /** Clone machine stack: gray floor → launcher → preview creature. */
  private readonly cloneMachineFloorSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly cloneMachineMidSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly clonerOverlaySprites = new Map<string, Phaser.GameObjects.Sprite>();
  /** Masked creature figure over floor tiles (toggle walls, fire, buttons). */
  private readonly monsterOverlaySprites = new Map<string, Phaser.GameObjects.Sprite>();

  private readonly chipCompositeTextureKeys = new Set<string>();

  private errorText?: Phaser.GameObjects.Text;

  private containerObserver: ResizeObserver | null = null;

  private pendingBuild = false;

  private assetsReady = false;
  private audioUrls: Record<string, string> = {};
  private levelSnapshot: LevelData | null = null;
  private oopsDialog: MsOopsDialog | null = null;
  private levelCompleteDialog: MsLevelCompleteDialog | null = null;
  private levelAttemptNumber = 1;
  private totalGameScore = 0;
  private inputLocked = false;
  private deathSequenceActive = false;
  private monsters: MsCc1MonsterState[] = [];
  private buttonPressCtx: MsCc1ButtonPressContext = {
    redButtonArmed: new Set(),
    openTraps: new Set(),
    moveBoundary: 0,
  };
  private monsterMoveTimer: Phaser.Time.TimerEvent | null = null;
  private levelIntro: MsLevelIntroBanner | null = null;
  private levelIntroDismissed = false;
  private chipSliding = false;
  private chipMoveChain: Promise<void> = Promise.resolve();



  constructor() {

    super({ key: "Play" });

  }



  create(): void {

    this.manifest = this.game.registry.get("manifest") as GameManifest;

    this.bus = this.game.registry.get("eventBus") as GameEventBus;

    this.game.events.on("pixel-zoom-changed", this.onDisplayResize, this);

    this.game.events.on("run-state", this.onRunState, this);

    this.game.events.on(GO_TO_LEVEL_EVENT, this.onGoToLevel, this);



    const container = document.getElementById("game-container");

    if (container) {

      this.containerObserver = new ResizeObserver(() => this.onDisplayResize());

      this.containerObserver.observe(container);

    }



    void this.boot();

  }



  private onDisplayResize(): void {

    if (!this.sys.isActive()) return;

    applyIntegerDisplayZoom(this.scale, document.getElementById("game-container"));

  }



  private async boot(): Promise<void> {

    if (!this.manifest.assetManifestUrl || !this.manifest.levelsIndexUrl) {

      this.showError("Manifest must include assetManifestUrl and levelsIndexUrl.");

      return;

    }



    try {

      const layoutUrl =

        this.manifest.windowLayoutUrl ??

        this.manifest.hudLayoutUrl ??

        "/games/chips-challenge-1/ui/ms-window-layout.json";

      this.windowLayout = await loadMsWindowLayout(layoutUrl);



      const assets = await loadAssetManifest(this.manifest.assetManifestUrl);
      this.audioUrls = assets.audio ?? {};
      if (!this.oopsDialog) {
        this.oopsDialog = new MsOopsDialog();
      }
      if (!this.levelCompleteDialog) {
        this.levelCompleteDialog = new MsLevelCompleteDialog();
      }

      const indexUrl = this.manifest.levelsIndexUrl;
      this.levelsIndex = await loadLevelsIndex(
        indexUrl.includes("?") ? indexUrl : `${indexUrl}?v=3`,
      );

      this.frameByTileId = buildMsFrameIndexByTileId();



      const sheet = assets.spritesheets?.[MS_TILES_KEY];

      const tilesUrl = sheet?.url ?? this.manifest.msAssets?.tilesUrl ?? "/ms-assets/tiles.png";

      const windowUrl =

        assets.images?.[MS_WINDOW_TEXTURE] ??

        "/games/chips-challenge-1/sprites/spritesheet_window.png";



      const needTiles = !this.textures.exists(MS_TILES_KEY);

      const needWindow = !this.textures.exists(MS_WINDOW_TEXTURE);



      const startLevel = async (): Promise<void> => {
        const pending = this.game.registry.get(REGISTRY_PENDING_LEVEL_NUMBER) as
          | number
          | undefined;
        const launchLevel =
          pending ??
          this.manifest.launchLevelNumber ??
          resolveDefaultLaunchLevelNumber(this.levelsIndex);
        if (pending != null) {
          this.game.registry.remove(REGISTRY_PENDING_LEVEL_NUMBER);
        }
        await this.goToLevelNumber(launchLevel);
      };



      if (!needTiles && !needWindow) {

        this.assetsReady = true;

        await startLevel();

        return;

      }



      if (needTiles) {

        this.load.spritesheet(MS_TILES_KEY, `${tilesUrl}?v=6`, {

          frameWidth: MS_TILE_SIZE,

          frameHeight: MS_TILE_SIZE,

        });

      }

      if (needWindow) {

        this.load.image(MS_WINDOW_TEXTURE, `${windowUrl}?v=6`);

      }

      this.load.once(Phaser.Loader.Events.COMPLETE, () => {

        void (async () => {

          if (!this.textures.exists(MS_TILES_KEY)) {

            this.showError(

              "MS tile sheet missing. Set cc1-install.local.json (installPath) or CC1_MS_INSTALL, then npm run ms:extract",

            );

            return;

          }

          if (!this.textures.exists(MS_WINDOW_TEXTURE)) {

            this.showError("MS window spritesheet missing.");

            return;

          }

          this.assetsReady = true;

          await startLevel();

        })();

      });

      this.load.on("loaderror", () => {

        this.showError(

          "Failed to load game assets. Ensure vendor tiles exist and spritesheet_window.png is present.",

        );

      });

      this.load.start();

    } catch (error) {

      const message = error instanceof Error ? error.message : String(error);

      this.showError(message);

    }

  }



  private async loadLevelAtIndex(index: number): Promise<void> {

    const entry = this.levelsIndex?.levels[index];

    if (!entry) {

      throw new Error(`Level index ${index} is out of range.`);

    }

    this.currentLevelIndex = index;

    this.level = await loadLevel(entry.url);

  }

  private levelUrlForNumber(levelNum: number): string {
    const sample =
      this.levelsIndex?.levels[0]?.url ??
      "/games/chips-challenge-1/levels/level-001.json";
    const dir = sample.replace(/\/[^/]+$/, "");
    return `${dir}/level-${String(levelNum).padStart(3, "0")}.json`;
  }

  private async goToLevelNumber(levelNum: number): Promise<void> {
    if (!this.assetsReady || !this.levelsIndex) {
      return;
    }

    const levelId = `level-${String(levelNum).padStart(3, "0")}`;
    const indexInCatalog = this.levelsIndex.levels.findIndex((entry) => entry.id === levelId);
    if (indexInCatalog >= 0) {
      await this.loadLevelAtIndex(indexInCatalog);
    } else {
      try {
        this.level = await loadLevel(this.levelUrlForNumber(levelNum));
      } catch {
        this.showTransientMessage(
          `Level ${levelNum} is not available. Export it with npm run dat:levels.`,
        );
        return;
      }
    }

    await this.prepareHud();
    this.buildPlayfield();
  }

  private readonly onGoToLevel = (levelNum: number): void => {
    void this.goToLevelNumber(levelNum);
  };

  /** `?password=XXXX` from URL (set in main before scene boot). */
  private async applyPendingLevelFromRegistry(): Promise<void> {
    const pending = this.game.registry.get(REGISTRY_PENDING_LEVEL_NUMBER) as number | undefined;
    if (pending == null) {
      return;
    }
    this.game.registry.remove(REGISTRY_PENDING_LEVEL_NUMBER);
    await this.goToLevelNumber(pending);
  }



  private async advanceToNextLevel(): Promise<void> {

    if (!this.levelsIndex) return;

    const nextIndex = this.currentLevelIndex + 1;

    if (nextIndex >= this.levelsIndex.levels.length) {

      this.showTransientMessage("All levels complete!");

      this.inputLocked = false;

      return;

    }

    await this.loadLevelAtIndex(nextIndex);

    this.buildPlayfield();

  }



  private async prepareHud(): Promise<void> {

    if (!this.windowLayout) return;

    if (!this.msHud) {

      this.msHud = new MsWindowHud(this, this.windowLayout, this.frameByTileId);

    }

    await this.msHud.prepareDigits();

  }



  private ensureBoardCamera(vp: MsWindowLayout["boardViewport"]): Phaser.Cameras.Scene2D.Camera {

    if (this.boardCam) {

      this.boardCam.setViewport(vp.x, vp.y, vp.width, vp.height);

      return this.boardCam;

    }



    const cam = this.cameras.add(vp.x, vp.y, vp.width, vp.height, false, "board");

    cam.setBackgroundColor(0x000000);

    cam.setRoundPixels(true);

    this.boardCam = cam;

    return cam;

  }



  private centerBoardCameraOn(gx: number, gy: number): void {
    if (!this.boardCam) return;
    this.boardCam.centerOn(
      this.boardOriginX + (gx + 0.5) * MS_TILE_SIZE,
      this.boardOriginY + (gy + 0.5) * MS_TILE_SIZE,
    );
  }

  /** Pan the board camera with Chip (ice / force slides and walk). */
  private followBoardCameraToChip(): void {
    if (!this.boardCam || !this.chip) return;
    this.boardCam.centerOn(this.chip.x, this.chip.y);
  }



  private buildPlayfield(restoreFromSnapshot = false): void {

    const layout = this.windowLayout;

    if (!layout) return;

    if (restoreFromSnapshot && this.levelSnapshot) {
      this.level = structuredClone(this.levelSnapshot);
    } else if (this.level) {
      this.levelSnapshot = structuredClone(this.level);
    }

    const level = this.level;

    if (!level) return;

    this.inputLocked = false;
    this.deathSequenceActive = false;
    this.chipMoveChain = Promise.resolve();

    if (restoreFromSnapshot) {
      this.levelAttemptNumber += 1;
    } else {
      this.levelAttemptNumber = 1;
    }

    if (this.pendingBuild) return;

    this.pendingBuild = true;



    const cw = level.width;

    const ch = level.height;

    const vp = layout.boardViewport;

    const tile = MS_TILE_SIZE;



    let gx = level.playerStart?.x ?? Math.floor(cw / 2);

    let gy = level.playerStart?.y ?? Math.floor(ch / 2);

    gx = Phaser.Math.Clamp(gx, 0, cw - 1);

    gy = Phaser.Math.Clamp(gy, 0, ch - 1);

    this.playerGx = gx;

    this.playerGy = gy;



    this.boardOriginX = vp.x;

    this.boardOriginY = vp.y;



    if (!this.msHud) {

      throw new Error("MS HUD digits not loaded");

    }

    this.msHud.build();

    this.msHud.applyLevel(level);



    this.runSession?.stop();

    const levelNum = level.hud?.levelNumber ?? this.currentLevelIndex + 1;

    const clock =

      level.timeLimit != null && level.timeLimit > 0 ? level.timeLimit : null;

    const chipsLeft = chipsLeftAtLevelStart(level);

    this.runSession = new RunSession(

      {

        levelNumber: levelNum,

        playClockInitialSeconds: clock,

        collectiblesInitialCount: chipsLeft,

      },

      (state) => this.game.events.emit("run-state", state),

    );

    this.runSession.start(this);

    this.monsters = createMsCc1Monsters(level);
    this.buttonPressCtx = {
      redButtonArmed: collectRedButtonCells(level),
      openTraps: new Set(),
      moveBoundary: 0,
      stepParity: "even",
    };
    this.chipSliding = false;
    this.startMonsterMoveClock();

    const boardCam = this.ensureBoardCamera(vp);

    boardCam.setZoom(1);



    this.tileLayer?.destroy(true);

    this.chip?.destroy();

    this.cellSprites.clear();
    this.cloneMachineFloorSprites.clear();
    this.cloneMachineMidSprites.clear();
    this.clonerOverlaySprites.clear();
    this.monsterOverlaySprites.clear();
    this.destroyChipCompositeTextures();

    this.tileLayer = this.add.container(0, 0).setDepth(10);



    const hasLayers = level.layers.upper.length > 0;



    for (let y = 0; y < ch; y++) {

      for (let x = 0; x < cw; x++) {

        if (hasLayers && isCloneMachineAt(level, x, y)) {
          this.placeCloneMachineCell(x, y);
          continue;
        }

        const tileId = hasLayers ? getCompositeTile(level, x, y) : "empty";

        if (CHIP_TILE_IDS.has(tileId)) continue;

        this.refreshCellAt(x, y);

      }

    }

    this.syncMonsterOverlays();

    const chipFrame = this.frameByTileId.get("chip_s") ?? 0;

    this.chip = this.add

      .sprite(

        this.boardOriginX + (gx + 0.5) * tile,

        this.boardOriginY + (gy + 0.5) * tile,

        MS_TILES_KEY,

        chipFrame,

      )

      .setOrigin(0.5)

      .setDepth(20);

    this.chip.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.chip.setBlendMode(Phaser.BlendModes.NORMAL);

    this.tweens.killTweensOf(this.chip);
    this.setChipFrameForDirection("down", msCc1StateFromRun([], 0));

    this.cameras.main.ignore([this.tileLayer, this.chip]);

    this.msHud.ignoreInBoardCamera(boardCam);



    this.centerBoardCameraOn(gx, gy);

    this.levelIntroDismissed = false;
    this.levelIntro ??= new MsLevelIntroBanner();
    const chipCenterX = this.boardOriginX + (gx + 0.5) * tile;
    const chipCenterY = this.boardOriginY + (gy + 0.5) * tile;
    const levelTitle = level.hud?.levelTitle ?? level.name ?? level.id;
    const password = level.metadata?.passwordPlain ?? "";
    this.levelIntro.show(this, layout, chipCenterX, chipCenterY, levelTitle, password);
    const introRoot = this.levelIntro.getRoot();
    if (introRoot) {
      this.cameras.main.ignore(introRoot);
    }

    this.unsubscribeDirection?.();

    this.unsubscribeDirection = this.bus.onDirection((direction) => this.onDirection(direction));



    this.game.events.emit("level-loaded", level);



    this.pendingBuild = false;

    this.time.delayedCall(0, () => this.onDisplayResize());

  }



  private readonly onRunState = (state: RunState): void => {

    this.msHud?.applyRunState(state);

  };

  private dismissLevelIntroAndStartClock(): void {
    if (this.levelIntroDismissed) {
      return;
    }
    this.levelIntroDismissed = true;
    this.levelIntro?.dismiss();
    this.runSession?.startPlayClock(this);
  }



  private readonly onDirection = (direction: Direction): void => {
    void (this.chipMoveChain = this.chipMoveChain.then(() =>
      this.performChipMove(direction),
    ));
  };

  private async performChipMove(direction: Direction): Promise<void> {
    if (!this.chip || !this.level || !this.runSession || this.inputLocked) {
      return;
    }

    this.dismissLevelIntroAndStartClock();

    const run = this.runSession.getState();
    const playerState = msCc1StateFromRun(
      run.inventory?.keys ?? [],
      run.collectiblesLeftCount,
      run.inventory?.tools ?? [],
    );

    const result = tryMsCc1Move(
      this.level,
      { x: this.playerGx, y: this.playerGy },
      direction,
      playerState,
      this.buttonPressCtx,
    );

    if (!result.moved) {
      this.setChipFrameForDirection(direction, result.state);
      return;
    }

    const movedSteps = result.steps.filter((step) => step.moved);

    // One tile: snap like MS voluntary step (responsive floor walking).
    if (movedSteps.length <= 1) {
      this.applyChipMoveResult(result, direction);
      return;
    }

    // Voluntary step snaps; involuntary ice / force chain animates.
    const [firstStep, ...slideSteps] = movedSteps;
    this.chipSliding = true;
    this.syncChipAfterStep(firstStep);
    this.runSession.applyMsCc1State(firstStep.state);

    if (firstStep.playerDied) {
      void this.handlePlayerDeath(firstStep.deathMessage ?? "Ooops!");
      return;
    }
    if (firstStep.completedLevel) {
      void this.handleLevelComplete();
      return;
    }

    for (const step of slideSteps) {
      await this.animateChipStep(step);
      this.runSession.applyMsCc1State(step.state);

      if (step.playerDied) {
        void this.handlePlayerDeath(step.deathMessage ?? "Ooops!");
        return;
      }
      if (step.completedLevel) {
        void this.handleLevelComplete();
        return;
      }
    }

    this.playerGx = result.position.x;
    this.playerGy = result.position.y;
    this.chipSliding = false;
    this.applyPostMoveEffects(result);
    this.setChipFrameForDirection(result.direction, result.state);
    this.refreshCellUnderChip(result.state.tools);
    this.followBoardCameraToChip();
  }

  private applyChipMoveResult(result: MsCc1MoveResult, direction: Direction): void {
    if (!this.chip) {
      return;
    }

    this.playerGx = result.position.x;
    this.playerGy = result.position.y;
    this.chip.setPosition(
      this.boardOriginX + (this.playerGx + 0.5) * MS_TILE_SIZE,
      this.boardOriginY + (this.playerGy + 0.5) * MS_TILE_SIZE,
    );
    this.runSession?.applyMsCc1State(result.state);

    for (const step of result.steps) {
      if (step.moved) {
        this.refreshCellAt(step.from.x, step.from.y);
      }
    }
    this.applyPostMoveEffects(result);

    this.setChipFrameForDirection(direction, result.state);
    this.refreshCellUnderChip(result.state.tools);
    this.centerBoardCameraOn(this.playerGx, this.playerGy);

    if (result.playerDied) {
      void this.handlePlayerDeath(result.deathMessage ?? "Ooops!");
      return;
    }
    if (result.completedLevel) {
      void this.handleLevelComplete();
    }
  }

  private animateChipStep(step: MsCc1MoveStep): Promise<void> {
    if (!this.chip) {
      return Promise.resolve();
    }

    const tile = MS_TILE_SIZE;
    const targetX = this.boardOriginX + (step.to.x + 0.5) * tile;
    const targetY = this.boardOriginY + (step.to.y + 0.5) * tile;

    if (
      Math.abs(this.chip.x - targetX) < 0.5 &&
      Math.abs(this.chip.y - targetY) < 0.5
    ) {
      this.syncChipAfterStep(step);
      return Promise.resolve();
    }

    this.tweens.killTweensOf(this.chip);

    const teleported =
      Math.abs(step.to.x - step.from.x) + Math.abs(step.to.y - step.from.y) > 1;
    if (teleported) {
      void this.playMsSound("teleport", this.audioUrls.teleport);
    }

    return new Promise((resolve) => {
      this.tweens.add({
        targets: this.chip,
        x: targetX,
        y: targetY,
        duration: teleported ? MS_CHIP_WALK_STEP_MS * 0.5 : MS_CHIP_WALK_STEP_MS,
        ease: "Linear",
        onUpdate: () => {
          this.followBoardCameraToChip();
          const tile = MS_TILE_SIZE;
          const gx = Math.floor((this.chip!.x - this.boardOriginX) / tile);
          const gy = Math.floor((this.chip!.y - this.boardOriginY) / tile);
          this.refreshCellUnderChip(step.state.tools, gx, gy);
        },
        onComplete: () => {
          this.syncChipAfterStep(step);
          resolve();
        },
      });
    });
  }

  private syncChipAfterStep(step: MsCc1MoveStep): void {
    if (!this.chip) return;

    const tile = MS_TILE_SIZE;
    this.playerGx = step.to.x;
    this.playerGy = step.to.y;
    this.chip.setPosition(
      this.boardOriginX + (this.playerGx + 0.5) * tile,
      this.boardOriginY + (this.playerGy + 0.5) * tile,
    );

    if (step.moved) {
      this.refreshCellAt(step.from.x, step.from.y);
    }
    for (const change of step.cellChanges) {
      this.refreshCellAt(change.x, change.y);
    }
    this.setChipFrameForDirection(step.direction, step.state);
    this.refreshCellUnderChip(step.state.tools, step.to.x, step.to.y);
    this.followBoardCameraToChip();
  }

  private async handleLevelComplete(): Promise<void> {
    if (!this.level || !this.runSession || this.inputLocked) {
      return;
    }
    this.inputLocked = true;
    this.stopMonsterMoveClock();
    this.runSession.stop();

    const levelNum = this.level.hud?.levelNumber ?? this.currentLevelIndex + 1;
    const secondsLeft = this.runSession.getState().playClockSeconds;
    const breakdown = buildMsLevelScoreBreakdown({
      levelNumber: levelNum,
      secondsRemaining: secondsLeft,
      attemptCount: this.levelAttemptNumber,
      priorTotalScore: this.totalGameScore,
    });
    this.totalGameScore = breakdown.totalScore;

    await this.levelCompleteDialog?.show(breakdown, { showTimeRecordMessage: true });
    await this.advanceToNextLevel();
  }

  /** MS move clock: monsters step 5× per game second even when Chip is idle. */
  private startMonsterMoveClock(): void {
    this.stopMonsterMoveClock();
    this.monsterMoveTimer = this.time.addEvent({
      delay: MS_MOVE_INTERVAL_MS,
      loop: true,
      callback: () => this.onMonsterMoveClockTick(),
    });
  }

  private stopMonsterMoveClock(): void {
    if (this.monsterMoveTimer) {
      this.monsterMoveTimer.destroy();
      this.monsterMoveTimer = null;
    }
  }

  /** Green / blue buttons, then one monster-list tick (MS order after Chip moves). */
  private applyPostMoveEffects(result: MsCc1MoveResult): void {
    if (!this.level) {
      return;
    }
    for (const step of result.steps) {
      if (step.moved) {
        applyButtonPressAt(
          this.level,
          step.from,
          step.to,
          this.monsters,
          result.cellChanges,
          this.buttonPressCtx,
        );
      }
    }
    for (const change of result.cellChanges) {
      this.refreshCellAt(change.x, change.y);
    }
    this.tickMonstersAfterChip(true);
  }

  private tickMonstersAfterChip(advanceTeethBoundary = false): void {
    if (!this.level || !this.chip || !this.runSession || this.inputLocked) {
      return;
    }

    const run = this.runSession.getState();
    const level = this.level;
    this.buttonPressCtx.chipIgnoresTeeth = this.chipSliding;
    const monsterTick = tickMsCc1Monsters(
      level,
      this.monsters,
      { x: this.playerGx, y: this.playerGy },
      run.collectiblesLeftCount,
      (from, to, cellChanges) => {
        applyButtonPressAt(
          level,
          from,
          to,
          this.monsters,
          cellChanges,
          this.buttonPressCtx,
        );
      },
      this.buttonPressCtx,
      { advanceTeethBoundary },
    );
    this.buttonPressCtx.chipIgnoresTeeth = false;

    for (const change of monsterTick.cellChanges) {
      this.refreshCellAt(change.x, change.y);
    }
    this.syncMonsterOverlays();

    if (monsterTick.chipDied) {
      void this.handlePlayerDeath(MS_DEATH_CREATURES);
    }
  }

  private onMonsterMoveClockTick(): void {
    this.tickMonstersAfterChip(false);
  }

  private async handlePlayerDeath(message: string): Promise<void> {
    if (this.deathSequenceActive) return;
    this.deathSequenceActive = true;
    this.inputLocked = true;
    this.chip?.setVisible(false);

    await this.playMsSound("bummer", this.audioUrls.bummer);
    await this.oopsDialog?.show(message);

    this.buildPlayfield(true);
  }

  private playMsSound(key: string, url?: string): Promise<void> {
    if (!url) return Promise.resolve();
    return new Promise((resolve) => {
      if (!this.cache.audio.exists(key)) {
        this.load.audio(key, url);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
          if (this.cache.audio.exists(key)) {
            this.sound.play(key, { volume: 1 });
          }
          resolve();
        });
        this.load.start();
        return;
      }
      this.sound.play(key, { volume: 1 });
      resolve();
    });
  }



  private hasFlippers(tools: string[] | undefined): boolean {
    return tools?.includes(FLIPPERS_TILE_ID) ?? false;
  }

  private isSwimmingAt(x: number, y: number, tools: string[] | undefined): boolean {
    if (!this.level || !this.hasFlippers(tools)) return false;
    return getCompositeTile(this.level, x, y) === "water";
  }

  private destroyChipCompositeTextures(): void {
    for (const key of this.chipCompositeTextureKeys) {
      this.textures.remove(key);
    }
    this.chipCompositeTextureKeys.clear();
  }

  private uploadChipCanvasTexture(
    key: string,
    pixels: Uint8ClampedArray,
  ): string {
    if (this.textures.exists(key)) {
      return key;
    }
    const tex = this.textures.createCanvas(key, MS_TILE_SIZE, MS_TILE_SIZE);
    if (!tex) {
      return MS_TILES_KEY;
    }
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, MS_TILE_SIZE, MS_TILE_SIZE);
    const imageData = ctx.createImageData(MS_TILE_SIZE, MS_TILE_SIZE);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    tex.refresh();
    this.chipCompositeTextureKeys.add(key);
    return key;
  }

  /** MS masked walk (cols 7–12): Chip figure only, transparent outside the mask. */
  private ensureChipMaskedWalkTexture(walkObjectCode: number): string {
    const key = `chip_mask_${walkObjectCode}`;
    if (this.textures.exists(key)) {
      return key;
    }
    const source = this.textures
      .get(MS_TILES_KEY)
      .getSourceImage() as CanvasImageSource;
    const pixels = compositeMsMaskedChipOnlyFromSheet(source, walkObjectCode);
    return this.uploadChipCanvasTexture(key, pixels);
  }

  /** MS creature preview on clone machines: figure only (cols 4–6), not the gray floor tile. */
  private ensureCreatureMaskedPreviewTexture(objectCode: number): string {
    const key = `creature_mask_${objectCode.toString(16)}`;
    if (this.textures.exists(key)) {
      return key;
    }
    const source = this.textures
      .get(MS_TILES_KEY)
      .getSourceImage() as CanvasImageSource;
    const pixels = compositeMsMaskedChipOnlyFromSheet(source, objectCode);
    return this.uploadChipCanvasTexture(key, pixels);
  }

  /** MS creature over a real floor tile (button, fire, toggle, etc.). */
  private ensureCreatureMaskedFloorTexture(
    floorTileId: string,
    creatureObjectCode: number,
  ): string {
    const key = `creature_${floorTileId}_${creatureObjectCode.toString(16)}`;
    if (this.textures.exists(key)) {
      return key;
    }
    const source = this.textures
      .get(MS_TILES_KEY)
      .getSourceImage() as CanvasImageSource;
    const floorFrame = this.frameByTileId.get(floorTileId) ?? 0;
    const pixels = compositeMsMaskedFromSheet(
      source,
      floorFrame,
      creatureObjectCode,
    );
    return this.uploadChipCanvasTexture(key, pixels);
  }

  /**
   * MS glider (col 5): draw overlay-column sprite on the floor tile.
   * Baked canvas composites for col 5 can fail in-browser; cols 4–6 ball/fire use composite.
   */
  private placeGhostFigureOnFloor(
    x: number,
    y: number,
    floorTileId: string,
    creatureTileId: string,
  ): void {
    if (!this.tileLayer) return;

    this.placeBoardSprite(x, y, floorTileId);
    const objectCode = objectCodeFromTileId(creatureTileId);
    if (objectCode == null) {
      return;
    }
    const overlayFrame = msMaskedChipFrameTriple(objectCode).overlay;
    this.placeCreatureSheetFrameOverlay(x, y, overlayFrame);
  }

  private placeCreatureSheetFrameOverlay(
    x: number,
    y: number,
    frame: number,
  ): void {
    if (!this.tileLayer) return;

    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.boardOriginX + x * tile;
    const py = this.boardOriginY + y * tile;

    let sprite = this.monsterOverlaySprites.get(key);
    if (!sprite) {
      sprite = this.add
        .sprite(px + tile / 2, py + tile / 2, MS_TILES_KEY, frame)
        .setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.tileLayer.add(sprite);
      this.monsterOverlaySprites.set(key, sprite);
    } else {
      sprite.setTexture(MS_TILES_KEY);
      sprite.setFrame(frame);
      sprite.setVisible(true);
    }
    this.tileLayer.bringToTop(sprite);
  }

  private placeCreatureCompositeOverlay(
    x: number,
    y: number,
    textureKey: string,
  ): void {
    if (!this.tileLayer) return;

    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.boardOriginX + x * tile;
    const py = this.boardOriginY + y * tile;

    let sprite = this.monsterOverlaySprites.get(key);
    if (!sprite) {
      sprite = this.add.sprite(px + tile / 2, py + tile / 2, textureKey).setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.tileLayer.add(sprite);
      this.monsterOverlaySprites.set(key, sprite);
    } else {
      sprite.setTexture(textureKey);
      sprite.setVisible(true);
    }
    this.tileLayer.bringToTop(sprite);
    this.cellSprites.get(key)?.setVisible(false);
  }

  /**
   * MS walk sprites include a gray floor (cols 4–6); on ice/fire/water/force the board
   * draws the terrain cell and Chip uses a masked walk sprite on top (no moving ice tile).
   * Swim sprites (col 3) are separate full tiles.
   */
  private setChipFrameForDirection(
    direction: Direction,
    state: { tools: string[] },
    atGx = this.playerGx,
    atGy = this.playerGy,
  ): void {
    if (!this.chip || !this.level) return;

    if (this.isSwimmingAt(atGx, atGy, state.tools)) {
      if (this.chip.texture.key !== MS_TILES_KEY) {
        this.chip.setTexture(MS_TILES_KEY);
      }
      const swimTile = CHIP_SWIM_FRAME[direction];
      const frame =
        this.frameByTileId.get(swimTile) ??
        this.frameByTileId.get("chip_swim_s") ??
        0;
      this.chip.setFrame(frame);
      return;
    }

    const terrainId = getTerrainTileUnderChip(this.level, atGx, atGy);
    if (terrainId) {
      const walkCode = MS_CHIP_WALK_OBJECT_CODE[direction];
      const texKey = this.ensureChipMaskedWalkTexture(walkCode);
      if (this.chip.texture.key !== texKey) {
        this.chip.setTexture(texKey);
      }
      return;
    }

    if (this.chip.texture.key !== MS_TILES_KEY) {
      this.chip.setTexture(MS_TILES_KEY);
    }
    const walkTile = CHIP_WALK_FRAME[direction];
    const frame =
      this.frameByTileId.get(walkTile) ??
      this.frameByTileId.get("chip_s") ??
      0;
    this.chip.setFrame(frame);
  }

  /** Keep ice, force floors, water, fire, etc. visible under Chip. */
  private refreshCellUnderChip(
    tools?: string[],
    atGx = this.playerGx,
    atGy = this.playerGy,
  ): void {
    if (!this.level) return;
    const key = `${atGx},${atGy}`;
    if (this.isSwimmingAt(atGx, atGy, tools)) {
      this.cellSprites.get(key)?.setVisible(false);
      return;
    }
    const tileId = getTerrainTileUnderChip(this.level, atGx, atGy);
    if (!tileId) return;
    // Terrain stays on the board; masked Chip sprite draws on top.
    this.refreshCellAt(atGx, atGy, tileId);
  }

  private placeBoardSprite(x: number, y: number, tileId: string): void {
    if (!this.tileLayer) return;

    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.boardOriginX + x * tile;
    const py = this.boardOriginY + y * tile;
    const frame = this.frameByTileId.get(tileId) ?? this.frameByTileId.get("empty") ?? 0;

    let sprite = this.cellSprites.get(key);
    if (!sprite) {
      sprite = this.add
        .sprite(px + tile / 2, py + tile / 2, MS_TILES_KEY, frame)
        .setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.tileLayer.add(sprite);
      this.cellSprites.set(key, sprite);
    } else {
      sprite.setVisible(true);
      sprite.setFrame(frame);
    }
  }

  private placeCloneMachineLayerSprite(
    x: number,
    y: number,
    tileId: string,
    store: Map<string, Phaser.GameObjects.Sprite>,
  ): void {
    if (!this.tileLayer) return;

    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.boardOriginX + x * tile;
    const py = this.boardOriginY + y * tile;
    const frame = this.frameByTileId.get(tileId) ?? this.frameByTileId.get("empty") ?? 0;

    let sprite = store.get(key);
    if (!sprite) {
      sprite = this.add
        .sprite(px + tile / 2, py + tile / 2, MS_TILES_KEY, frame)
        .setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.tileLayer.add(sprite);
      store.set(key, sprite);
    } else {
      sprite.setVisible(true);
      sprite.setFrame(frame);
    }
  }

  private hideCloneMachineSprites(x: number, y: number): void {
    const key = `${x},${y}`;
    this.cloneMachineFloorSprites.get(key)?.setVisible(false);
    this.cloneMachineMidSprites.get(key)?.setVisible(false);
    this.clonerOverlaySprites.get(key)?.setVisible(false);
  }

  /** Full-tile creature (cols 0–3, 7–12) over floor at a runtime monster cell. */
  private placeRuntimeMonsterOverlay(x: number, y: number, tileId: string): void {
    if (!this.tileLayer) return;

    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.boardOriginX + x * tile;
    const py = this.boardOriginY + y * tile;
    const frame = this.frameByTileId.get(tileId) ?? 0;

    let sprite = this.monsterOverlaySprites.get(key);
    if (!sprite) {
      sprite = this.add
        .sprite(px + tile / 2, py + tile / 2, MS_TILES_KEY, frame)
        .setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.tileLayer.add(sprite);
      this.monsterOverlaySprites.set(key, sprite);
    } else {
      sprite.setTexture(MS_TILES_KEY);
      sprite.setFrame(frame);
      sprite.setVisible(true);
    }
  }

  private placeMaskedCreatureOverlay(
    x: number,
    y: number,
    objectCode: number,
    store: Map<string, Phaser.GameObjects.Sprite>,
  ): void {
    if (!this.tileLayer) return;

    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.boardOriginX + x * tile;
    const py = this.boardOriginY + y * tile;
    const texKey = this.ensureCreatureMaskedPreviewTexture(objectCode);

    let sprite = store.get(key);
    if (!sprite) {
      sprite = this.add.sprite(px + tile / 2, py + tile / 2, texKey).setOrigin(0.5);
      sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.tileLayer.add(sprite);
      store.set(key, sprite);
    } else {
      sprite.setTexture(texKey);
      sprite.setVisible(true);
    }
  }

  private hideMaskedCreatureOverlay(
    x: number,
    y: number,
    store: Map<string, Phaser.GameObjects.Sprite>,
  ): void {
    store.get(`${x},${y}`)?.setVisible(false);
  }

  /** MS: gray floor, then launcher box, then preview creature icon. */
  private placeCloneMachineCell(x: number, y: number): void {
    if (!this.level || !this.tileLayer) return;

    const key = `${x},${y}`;
    this.cellSprites.get(key)?.setVisible(false);

    this.placeCloneMachineLayerSprite(x, y, "empty", this.cloneMachineFloorSprites);
    this.placeCloneMachineLayerSprite(x, y, "cloner", this.cloneMachineMidSprites);

    const preview = cellTile(this.level, "upper", x, y);
    if (isMonsterTile(preview)) {
      const objectCode = objectCodeFromTileId(preview);
      if (objectCode != null) {
        this.placeMaskedCreatureOverlay(x, y, objectCode, this.clonerOverlaySprites);
      } else {
        this.clonerOverlaySprites.get(key)?.setVisible(false);
      }
    } else {
      this.clonerOverlaySprites.get(key)?.setVisible(false);
    }
  }

  private refreshCloneMachineCell(x: number, y: number): void {
    this.placeCloneMachineCell(x, y);
  }

  private findMonsterAt(x: number, y: number): MsCc1MonsterState | undefined {
    return this.monsters.find((m) => m.alive && m.x === x && m.y === y);
  }

  /** Redraw live creatures on the board tile layer (masked MS cols 4–6). */
  private syncMonsterOverlays(): void {
    if (!this.level || !this.tileLayer) return;

    const occupied = new Set<string>();
    for (const monster of this.monsters) {
      if (!monster.alive) continue;
      occupied.add(`${monster.x},${monster.y}`);
      this.refreshCellAt(monster.x, monster.y);
    }

    for (const [key, sprite] of this.monsterOverlaySprites) {
      if (!occupied.has(key)) {
        sprite.setVisible(false);
      }
    }
  }

  /** Redraw a board cell from the current level layers. */
  private refreshCellAt(
    x: number,
    y: number,
    tileIdOverride?: string,
  ): void {
    if (!this.level || !this.tileLayer) return;

    if (isCloneMachineAt(this.level, x, y)) {
      this.refreshCloneMachineCell(x, y);
      return;
    }

    this.hideCloneMachineSprites(x, y);

    const occupant = this.findMonsterAt(x, y);
    if (occupant) {
      const lower = cellTile(this.level, "lower", x, y);
      const floorId = lower !== "empty" ? lower : "empty";
      this.hideMaskedCreatureOverlay(x, y, this.monsterOverlaySprites);
      if (occupant.kind === "ghost") {
        this.placeGhostFigureOnFloor(x, y, floorId, occupant.tileId);
        return;
      }
      const objectCode = objectCodeFromTileId(occupant.tileId);
      if (objectCode != null && msCreatureUsesMaskedSprite(objectCode)) {
        const texKey = this.ensureCreatureMaskedFloorTexture(floorId, objectCode);
        this.placeCreatureCompositeOverlay(x, y, texKey);
      } else {
        this.placeBoardSprite(x, y, floorId);
        this.placeRuntimeMonsterOverlay(x, y, occupant.tileId);
      }
      return;
    }

    const tileId = tileIdOverride ?? getCompositeTile(this.level, x, y);
    const key = `${x},${y}`;

    if (CHIP_TILE_IDS.has(tileId)) {
      this.cellSprites.get(key)?.setVisible(false);
      this.hideMaskedCreatureOverlay(x, y, this.monsterOverlaySprites);
      return;
    }

    const floorUnderMonster = getLowerTileUnderMonster(this.level, x, y);
    if (isMonsterTile(tileId) && floorUnderMonster) {
      if (tileId.startsWith("ghost_")) {
        this.placeGhostFigureOnFloor(x, y, floorUnderMonster, tileId);
        return;
      }
      const objectCode = objectCodeFromTileId(tileId);
      if (objectCode != null && msCreatureUsesMaskedSprite(objectCode)) {
        const texKey = this.ensureCreatureMaskedFloorTexture(
          floorUnderMonster,
          objectCode,
        );
        this.placeCreatureCompositeOverlay(x, y, texKey);
        return;
      }
    }

    this.hideMaskedCreatureOverlay(x, y, this.monsterOverlaySprites);
    this.placeBoardSprite(x, y, tileId);
  }



  private showError(message: string): void {

    console.error(message);

    this.errorText?.destroy();

    const { width, height } = this.scale;

    this.errorText = this.add

      .text(width / 2, height / 2, message, {

        fontFamily: "monospace",

        fontSize: "12px",

        color: "#f06b6b",

        align: "center",

        wordWrap: { width: width - 24 },

      })

      .setOrigin(0.5)

      .setDepth(100);

  }



  private showTransientMessage(message: string): void {

    const { width, height } = this.scale;

    const text = this.add

      .text(width / 2, height / 2, message, {

        fontFamily: "monospace",

        fontSize: "14px",

        color: "#9fe29f",

        align: "center",

      })

      .setOrigin(0.5)

      .setDepth(100);

    this.time.delayedCall(2000, () => text.destroy());

  }



  shutdown(): void {

    this.containerObserver?.disconnect();

    this.containerObserver = null;

    this.game.events.off("pixel-zoom-changed", this.onDisplayResize, this);

    this.game.events.off("run-state", this.onRunState, this);

    this.game.events.off(GO_TO_LEVEL_EVENT, this.onGoToLevel, this);

    this.unsubscribeDirection?.();

    this.unsubscribeDirection = null;

    if (this.boardCam) {

      this.boardCam.destroy();

      this.boardCam = null;

    }

    this.stopMonsterMoveClock();

    this.runSession?.stop();

    this.runSession = null;

    this.msHud?.destroy();

    this.msHud = null;

    this.oopsDialog?.destroy();

    this.oopsDialog = null;

    this.levelCompleteDialog?.destroy();

    this.levelCompleteDialog = null;

    this.cellSprites.clear();
    this.cloneMachineFloorSprites.clear();
    this.cloneMachineMidSprites.clear();
    this.clonerOverlaySprites.clear();
    this.monsterOverlaySprites.clear();

  }

}


