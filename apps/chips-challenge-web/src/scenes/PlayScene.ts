import Phaser from "phaser";
import type { Direction, GameManifest, LevelData, LevelsIndex } from "@engine/types";
import type { DirectionInput } from "@engine/DirectionInput";
import type { GameEventBus } from "@engine/GameEventBus";
import { forceFloorDirection } from "@engine/msCc1/msCc1Sliding";
import {
  directionInputIsActive,
  getForceFloorTileAt,
} from "../engine/msCc1Compat";
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
import { applyIntegerDisplayZoom } from "@engine/pixelZoom";
import { resolveRulesetContext, type RulesetContext } from "@engine/ruleset/index";
import { MS_TILE_SIZE } from "@tile-engine/msTileIndex";
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
import { GAME_PACK_BASE, MS_TILES_PNG_URL } from "../config/gamePack";
import { areSoundEffectsEnabled } from "../ui/soundPreferences";
import { MS_TILES_KEY } from "./play/constants";
import { createPlayBoardView } from "./play/boardState";
import { PlayBoardPresenter } from "./play/PlayBoardPresenter";



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

  private frameByTileId = new Map<string, number>();



  private msHud: MsWindowHud | null = null;

  private runSession: RunSession | null = null;

  private boardCam: Phaser.Cameras.Scene2D.Camera | null = null;

  private readonly boardView = createPlayBoardView();
  private board!: PlayBoardPresenter;
  private rulesetCtx: RulesetContext | null = null;

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
    this.board = new PlayBoardPresenter(this, this.boardView);
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

        `${GAME_PACK_BASE}/ui/ms-window-layout.json`;

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
      this.boardView.frameByTileId = this.frameByTileId;



      const sheet = assets.spritesheets?.[MS_TILES_KEY];

      const tilesUrl = sheet?.url ?? this.manifest.msAssets?.tilesUrl ?? MS_TILES_PNG_URL;

      const windowUrl =

        assets.images?.[MS_WINDOW_TEXTURE] ??

        `${GAME_PACK_BASE}/sprites/spritesheet_window.png`;



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
    await this.bindRulesetForLevel();
  }

  private async bindRulesetForLevel(): Promise<void> {
    if (!this.level) {
      this.rulesetCtx = null;
      this.boardView.level = null;
      return;
    }
    this.boardView.level = this.level;
    try {
      this.rulesetCtx = await resolveRulesetContext(this.level, GAME_PACK_BASE);
      if (
        this.rulesetCtx &&
        this.level.contentPack &&
        this.rulesetCtx.contentPack.id !== this.level.contentPack
      ) {
        console.warn(
          `Level contentPack "${this.level.contentPack}" does not match loaded "${this.rulesetCtx.contentPack.id}"`,
        );
      }
    } catch (error) {
      console.warn("Ruleset/content pack load failed:", error);
      this.rulesetCtx = null;
    }
  }

  private levelUrlForNumber(levelNum: number): string {
    const sample =
      this.levelsIndex?.levels[0]?.url ??
      `${GAME_PACK_BASE}/levels/level-001.json`;
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
        await this.bindRulesetForLevel();
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
      this.boardView.boardOriginX + (gx + 0.5) * MS_TILE_SIZE,
      this.boardView.boardOriginY + (gy + 0.5) * MS_TILE_SIZE,
    );
  }

  /** Pan the board camera with Chip (ice / force slides and walk). */
  private followBoardCameraToChip(): void {
    if (!this.boardCam || !this.boardView.chip) return;
    this.boardCam.centerOn(this.boardView.chip.x, this.boardView.chip.y);
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

    this.boardView.level = level;

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
    this.boardView.playerGx = gx;
    this.boardView.playerGy = gy;
    this.boardView.boardOriginX = vp.x;
    this.boardView.boardOriginY = vp.y;



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
    this.boardView.monsters = this.monsters;
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



    this.board.clearSpriteLayers();
    this.board.createTileLayer();

    this.board.paintStaticCells();

    const chipFrame = this.frameByTileId.get("chip_s") ?? 0;
    const chip = this.board.createChipSprite(gx, gy, chipFrame);
    this.tweens.killTweensOf(chip);
    this.board.setChipFrameForDirection("down", msCc1StateFromRun([], 0));

    this.cameras.main.ignore([this.boardView.tileLayer!, chip]);

    this.msHud.ignoreInBoardCamera(boardCam);



    this.centerBoardCameraOn(gx, gy);

    this.levelIntroDismissed = false;
    this.levelIntro ??= new MsLevelIntroBanner();
    const chipCenterX = this.boardView.boardOriginX + (gx + 0.5) * tile;
    const chipCenterY = this.boardView.boardOriginY + (gy + 0.5) * tile;
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
    if (!this.boardView.chip || !this.level || !this.runSession || this.inputLocked) {
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
      { openTraps: this.buttonPressCtx.openTraps },
    );

    if (!result.moved) {
      this.board.setChipFrameForDirection(direction, result.state);
      return;
    }

    const movedSteps = result.steps.filter((step) => step.moved);

    // One tile: snap like MS voluntary step (responsive floor walking).
    if (movedSteps.length <= 1) {
      this.applyChipMoveResult(result, direction);
      await this.continueForceFloorWithoutInput();
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
    this.boardView.playerGx = this.playerGx;
    this.boardView.playerGy = this.playerGy;
    this.chipSliding = false;
    this.applyPostMoveEffects(result);
    this.board.setChipFrameForDirection(result.direction, result.state);
    this.board.refreshCellUnderChip(result.state.tools);
    this.followBoardCameraToChip();
    await this.continueForceFloorWithoutInput();
  }

  /** MS: force floors keep pushing after perpendicular input is released. */
  private async continueForceFloorWithoutInput(): Promise<void> {
    const input = this.game.registry.get("directionInput") as
      | DirectionInput
      | undefined;
    if (directionInputIsActive(input)) {
      return;
    }
    if (!this.level || this.inputLocked) {
      return;
    }
    const forceTile = getForceFloorTileAt(this.level, this.playerGx, this.playerGy);
    if (!forceTile) {
      return;
    }
    const autoDir = forceFloorDirection(forceTile);
    if (!autoDir) {
      return;
    }
    await this.performChipMove(autoDir);
  }

  private applyChipMoveResult(result: MsCc1MoveResult, direction: Direction): void {
    if (!this.boardView.chip) {
      return;
    }

    this.playerGx = result.position.x;
    this.playerGy = result.position.y;
    this.boardView.playerGx = this.playerGx;
    this.boardView.playerGy = this.playerGy;
    this.boardView.chip.setPosition(
      this.boardView.boardOriginX + (this.playerGx + 0.5) * MS_TILE_SIZE,
      this.boardView.boardOriginY + (this.playerGy + 0.5) * MS_TILE_SIZE,
    );
    this.runSession?.applyMsCc1State(result.state);

    for (const step of result.steps) {
      if (step.moved) {
        this.board.refreshCellAt(step.from.x, step.from.y);
        this.board.refreshCellAt(step.to.x, step.to.y);
      }
    }
    this.applyPostMoveEffects(result);

    this.board.setChipFrameForDirection(direction, result.state);
    this.board.refreshCellUnderChip(result.state.tools);
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
    if (!this.boardView.chip) {
      return Promise.resolve();
    }

    const tile = MS_TILE_SIZE;
    const targetX = this.boardView.boardOriginX + (step.to.x + 0.5) * tile;
    const targetY = this.boardView.boardOriginY + (step.to.y + 0.5) * tile;

    if (
      Math.abs(this.boardView.chip.x - targetX) < 0.5 &&
      Math.abs(this.boardView.chip.y - targetY) < 0.5
    ) {
      this.syncChipAfterStep(step);
      return Promise.resolve();
    }

    this.tweens.killTweensOf(this.boardView.chip);

    const teleported =
      Math.abs(step.to.x - step.from.x) + Math.abs(step.to.y - step.from.y) > 1;
    if (teleported) {
      void this.playMsSound("teleport", this.audioUrls.teleport);
    }

    return new Promise((resolve) => {
      this.tweens.add({
        targets: this.boardView.chip,
        x: targetX,
        y: targetY,
        duration: teleported ? MS_CHIP_WALK_STEP_MS * 0.5 : MS_CHIP_WALK_STEP_MS,
        ease: "Linear",
        onUpdate: () => {
          this.followBoardCameraToChip();
          const tile = MS_TILE_SIZE;
          const gx = Math.floor((this.boardView.chip!.x - this.boardView.boardOriginX) / tile);
          const gy = Math.floor((this.boardView.chip!.y - this.boardView.boardOriginY) / tile);
          this.board.refreshCellUnderChip(step.state.tools, gx, gy);
        },
        onComplete: () => {
          this.syncChipAfterStep(step);
          resolve();
        },
      });
    });
  }

  private syncChipAfterStep(step: MsCc1MoveStep): void {
    if (!this.boardView.chip) return;

    const tile = MS_TILE_SIZE;
    this.playerGx = step.to.x;
    this.playerGy = step.to.y;
    this.boardView.playerGx = this.playerGx;
    this.boardView.playerGy = this.playerGy;
    this.boardView.chip.setPosition(
      this.boardView.boardOriginX + (this.playerGx + 0.5) * tile,
      this.boardView.boardOriginY + (this.playerGy + 0.5) * tile,
    );

    if (step.moved) {
      this.board.refreshCellAt(step.from.x, step.from.y);
    }
    for (const change of step.cellChanges) {
      this.board.refreshCellAt(change.x, change.y);
    }
    this.board.setChipFrameForDirection(step.direction, step.state);
    this.board.refreshCellUnderChip(step.state.tools, step.to.x, step.to.y);
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

  /** MS move clock: monsters step 5Ã— per game second even when Chip is idle. */
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
      this.board.refreshCellAt(change.x, change.y);
    }
    this.tickMonstersAfterChip(true);
  }

  private tickMonstersAfterChip(advanceTeethBoundary = false): void {
    if (!this.level || !this.boardView.chip || !this.runSession || this.inputLocked) {
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
      this.board.refreshCellAt(change.x, change.y);
    }
    this.board.syncMonsterOverlays();

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
    this.boardView.chip?.setVisible(false);

    await this.playMsSound("bummer", this.audioUrls.bummer);
    await this.oopsDialog?.show(message);

    this.buildPlayfield(true);
  }

  private playMsSound(key: string, url?: string): Promise<void> {
    if (!url || !areSoundEffectsEnabled()) return Promise.resolve();
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

    this.boardView.cellSprites.clear();
    this.boardView.cloneMachineFloorSprites.clear();
    this.boardView.cloneMachineMidSprites.clear();
    this.boardView.clonerOverlaySprites.clear();
    this.boardView.monsterOverlaySprites.clear();
  }

}


