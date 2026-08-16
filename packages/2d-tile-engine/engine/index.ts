/**
 * Public engine surface for apps and the extraction pipeline.
 * Prefer `@engine/index.js` or specific `@engine/<module>.js` paths.
 */

export type {
  AssetManifest,
  Direction,
  GameManifest,
  HudInventorySlot,
  HudLayout,
  LevelData,
  LevelHud,
  LevelIndexEntry,
  LevelLayerCompact,
  LevelLayers,
  LevelLayersSerialized,
  LevelMonster,
  LevelsIndex,
  OriginalLevelMeta,
  OriginalLevelReferenceDoc,
  RunState,
  TilesetCatalog,
} from "./types.js";

export { GameEngine } from "./GameEngine.js";
export { GameEventBus } from "./GameEventBus.js";
export { DirectionInput } from "./DirectionInput.js";
export {
  loadAssetManifest,
  loadGameManifest,
  loadLevel,
  loadLevelsIndex,
  loadOriginalLevelReference,
  loadTilesetCatalog,
} from "./ConfigLoader.js";
export {
  compactLayer,
  compactLayers,
  expandLayer,
  isCompactLayer,
  normalizeLevelLayers,
} from "./levelLayers.js";
export { RunSession } from "./RunSession.js";
export {
  cellTile,
  getCompositeTile,
  getLowerTileUnderMonster,
  isCloneMachineAt,
} from "./levelRuntime.js";
export { chipsLeftAtLevelStart, countCollectiblesOnMap } from "./countCollectibles.js";
export { buildMsFrameIndexByTileId } from "./msTileFrames.js";
export { applyIntegerDisplayZoom, bumpPixelZoom, getPixelZoom } from "./pixelZoom.js";
export {
  REGISTRY_PENDING_LEVEL_NUMBER,
  resolveDefaultLaunchLevelNumber,
  resolveLevelNumberFromPassword,
} from "./levelPassword.js";
export {
  loadContentPack,
  loadRuleset,
  resolveRulesetContext,
  RulesetContext,
} from "./ruleset/index.js";
export type { ContentPackDoc, ContentTileDef, RulesetDoc } from "./ruleset/types.js";
