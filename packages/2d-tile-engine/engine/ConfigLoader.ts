import { normalizeLevelLayers } from "./levelLayers.js";
import type {
  AssetManifest,
  GameManifest,
  LevelData,
  LevelsIndex,
  OriginalLevelReferenceDoc,
  TilesetCatalog,
} from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load JSON: ${url} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function loadGameManifest(url: string): Promise<GameManifest> {
  return fetchJson<GameManifest>(url);
}

export async function loadAssetManifest(url: string): Promise<AssetManifest> {
  return fetchJson<AssetManifest>(url);
}

export async function loadLevelsIndex(url: string): Promise<LevelsIndex> {
  return fetchJson<LevelsIndex>(url);
}

export async function loadLevel(url: string): Promise<LevelData> {
  const level = await fetchJson<LevelData>(url);
  normalizeLevelLayers(level);
  return level;
}

export async function loadTilesetCatalog(url: string): Promise<TilesetCatalog> {
  return fetchJson<TilesetCatalog>(url);
}

export async function loadOriginalLevelReference(url: string): Promise<OriginalLevelReferenceDoc> {
  return fetchJson<OriginalLevelReferenceDoc>(url);
}
