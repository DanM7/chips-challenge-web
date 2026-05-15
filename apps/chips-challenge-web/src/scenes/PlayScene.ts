import Phaser from "phaser";
import type { Direction, GameManifest, LevelData } from "../engine/types";
import type { GameEventBus } from "../engine/GameEventBus";
import { loadAssetManifest, loadLevel, loadLevelsIndex } from "../engine/ConfigLoader";
import { buildMsFrameIndexByTileId } from "../engine/msTileFrames";
import { countCollectiblesOnMap } from "../engine/countCollectibles";
import { RunSession } from "../engine/RunSession";
import type { RunState } from "../engine/types";
import {
  doorToKeyId,
  getCompositeTile,
  getFloorTileId,
  isBlockedCell,
  isDoorTile,
  isKeyTile,
  removeCollectibleAt,
  removeTileAt,
} from "../engine/levelRuntime";
import { CHIP_TILE_IDS, COLLECTIBLE_CHIP_TILE_ID } from "../dat/tiles";
import { MS_TILE_SIZE } from "../dat/msTileIndex";
import { applyIntegerDisplayZoom } from "../engine/pixelZoom";
import { MsWindowHud } from "../ui/MsWindowHud";
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

export class PlayScene extends Phaser.Scene {
  private manifest!: GameManifest;
  private bus!: GameEventBus;
  private unsubscribeDirection: (() => void) | null = null;

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
  private errorText?: Phaser.GameObjects.Text;
  private containerObserver: ResizeObserver | null = null;
  private pendingBuild = false;

  constructor() {
    super({ key: "Play" });
  }

  create(): void {
    this.manifest = this.game.registry.get("manifest") as GameManifest;
    this.bus = this.game.registry.get("eventBus") as GameEventBus;
    this.game.events.on("pixel-zoom-changed", this.onDisplayResize, this);
    this.game.events.on("run-state", this.onRunState, this);

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
        "/games/chips-challenge-100/ui/ms-window-layout.json";
      this.windowLayout = await loadMsWindowLayout(layoutUrl);

      const assets = await loadAssetManifest(this.manifest.assetManifestUrl);
      const index = await loadLevelsIndex(this.manifest.levelsIndexUrl);
      const defaultId = index.defaultLevelId ?? index.levels[0]?.id;
      const entry = index.levels.find((level) => level.id === defaultId) ?? index.levels[0];
      if (!entry) {
        this.showError("Levels index has no levels.");
        return;
      }

      const level = await loadLevel(entry.url);
      this.level = level;
      this.frameByTileId = buildMsFrameIndexByTileId();

      const sheet = assets.spritesheets?.[MS_TILES_KEY];
      const tilesUrl = sheet?.url ?? this.manifest.msAssets?.tilesUrl ?? "/ms-assets/tiles.png";
      const windowUrl =
        assets.images?.[MS_WINDOW_TEXTURE] ??
        "/games/chips-challenge-100/sprites/spritesheet_window.png";

      const needTiles = !this.textures.exists(MS_TILES_KEY);
      const needWindow = !this.textures.exists(MS_WINDOW_TEXTURE);
      if (!needTiles && !needWindow) {
        await this.prepareHud();
        this.buildPlayfield();
        return;
      }

      if (needTiles) {
        this.load.spritesheet(MS_TILES_KEY, `${tilesUrl}?v=5`, {
          frameWidth: MS_TILE_SIZE,
          frameHeight: MS_TILE_SIZE,
        });
      }
      if (needWindow) {
        this.load.image(MS_WINDOW_TEXTURE, windowUrl);
      }
      this.load.once(Phaser.Loader.Events.COMPLETE, async () => {
        if (!this.textures.exists(MS_TILES_KEY)) {
          this.showError(
            "MS tile sheet missing. Run: npm run vendor:ensure && npm run ms:extract",
          );
          return;
        }
        if (!this.textures.exists(MS_WINDOW_TEXTURE)) {
          this.showError("MS window spritesheet missing.");
          return;
        }
        await this.prepareHud();
        this.buildPlayfield();
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

  private buildPlayfield(): void {
    const level = this.level;
    const layout = this.windowLayout;
    if (!level || !layout) return;

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
    const levelNum = level.hud?.levelNumber ?? 1;
    const clock =
      level.timeLimit != null && level.timeLimit > 0 ? level.timeLimit : null;
    const collectibles =
      level.hud?.collectiblesOnMap ?? countCollectiblesOnMap(level);
    this.runSession = new RunSession(
      {
        levelNumber: levelNum,
        playClockInitialSeconds: clock,
        collectiblesInitialCount: collectibles,
      },
      (state) => this.game.events.emit("run-state", state),
    );
    this.runSession.start(this);

    const boardCam = this.ensureBoardCamera(vp);
    boardCam.setZoom(1);

    this.tileLayer?.destroy(true);
    this.chip?.destroy();
    this.cellSprites.clear();
    this.tileLayer = this.add.container(0, 0).setDepth(10);

    const hasLayers = level.layers.upper.length > 0;

    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const tileId = hasLayers ? getCompositeTile(level, x, y) : "empty";
        if (CHIP_TILE_IDS.has(tileId)) continue;

        const frame = this.frameByTileId.get(tileId) ?? 0;
        const px = this.boardOriginX + x * tile;
        const py = this.boardOriginY + y * tile;
        const sprite = this.add
          .sprite(px + tile / 2, py + tile / 2, MS_TILES_KEY, frame)
          .setOrigin(0.5);
        sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.tileLayer.add(sprite);
        this.cellSprites.set(`${x},${y}`, sprite);
      }
    }

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

    this.cameras.main.ignore([this.tileLayer, this.chip]);
    this.msHud.ignoreInBoardCamera(boardCam);

    this.centerBoardCameraOn(gx, gy);

    this.unsubscribeDirection?.();
    this.unsubscribeDirection = this.bus.onDirection((direction) => this.onDirection(direction));

    this.game.events.emit("level-loaded", level);

    this.pendingBuild = false;
    this.time.delayedCall(0, () => this.onDisplayResize());
  }

  private readonly onRunState = (state: RunState): void => {
    this.msHud?.applyRunState(state);
  };

  private onDirection(direction: Direction): void {
    if (!this.chip || !this.level) return;

    const walkId = CHIP_WALK_FRAME[direction];
    const frame = this.frameByTileId.get(walkId) ?? this.frameByTileId.get("chip_s") ?? 0;
    this.chip.setFrame(frame);

    const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
    const dy = direction === "up" ? -1 : direction === "down" ? 1 : 0;
    const nx = this.playerGx + dx;
    const ny = this.playerGy + dy;

    if (nx < 0 || nx >= this.level.width || ny < 0 || ny >= this.level.height) {
      return;
    }
    const destTile = getCompositeTile(this.level, nx, ny);

    if (isDoorTile(destTile)) {
      const keyId = doorToKeyId(destTile);
      if (!keyId || !this.runSession?.hasKey(keyId)) {
        return;
      }
      this.runSession.consumeKey(keyId);
      removeTileAt(this.level, nx, ny, destTile);
      this.revealFloorAt(nx, ny);
    } else if (isBlockedCell(this.level, nx, ny)) {
      return;
    }

    if (CHIP_TILE_IDS.has(destTile)) {
      return;
    }

    this.playerGx = nx;
    this.playerGy = ny;
    this.chip.setPosition(
      this.boardOriginX + (nx + 0.5) * MS_TILE_SIZE,
      this.boardOriginY + (ny + 0.5) * MS_TILE_SIZE,
    );
    this.tryPickUpAt(nx, ny);
    this.centerBoardCameraOn(nx, ny);
  }

  private tryPickUpAt(x: number, y: number): void {
    if (!this.level || !this.runSession) return;

    const tile = getCompositeTile(this.level, x, y);

    if (tile === COLLECTIBLE_CHIP_TILE_ID) {
      if (!removeCollectibleAt(this.level, x, y, COLLECTIBLE_CHIP_TILE_ID)) return;
      this.revealFloorAt(x, y);
      this.runSession.collectOne();
      return;
    }

    if (isKeyTile(tile)) {
      if (!this.runSession.tryAddKey(tile)) return;
      if (!removeCollectibleAt(this.level, x, y, tile)) return;
      this.revealFloorAt(x, y);
    }
  }

  /** After a collectible is removed, show the floor tile that was underneath. */
  private revealFloorAt(x: number, y: number): void {
    if (!this.level || !this.tileLayer) return;

    const floorId = getFloorTileId(this.level, x, y);
    const frame = this.frameByTileId.get(floorId) ?? 0;
    const key = `${x},${y}`;
    const tile = MS_TILE_SIZE;
    const px = this.boardOriginX + x * tile;
    const py = this.boardOriginY + y * tile;

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

  shutdown(): void {
    this.containerObserver?.disconnect();
    this.containerObserver = null;
    this.game.events.off("pixel-zoom-changed", this.onDisplayResize, this);
    this.game.events.off("run-state", this.onRunState, this);
    this.unsubscribeDirection?.();
    this.unsubscribeDirection = null;
    if (this.boardCam) {
      this.boardCam.destroy();
      this.boardCam = null;
    }
    this.runSession?.stop();
    this.runSession = null;
    this.msHud?.destroy();
    this.msHud = null;
    this.cellSprites.clear();
  }
}
