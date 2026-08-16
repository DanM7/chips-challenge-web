/** Ruleset document (`rulesets/grid-arcade-v1.json`). */
export interface RulesetDoc {
  id: string;
  systems?: string[];
  archetypes?: Record<string, { onEnter?: string[]; blocksActor?: boolean; onBlockedByActor?: string[] }>;
  objectiveTypes?: Record<string, { tag?: string }>;
}

/** Content pack tile behavior (`content/ms-cc1.json`). */
export interface ContentTileDef {
  archetype: string;
  tags?: string[];
  params?: Record<string, unknown>;
  blocksActor?: boolean;
}

export interface ContentPackDoc {
  id: string;
  ruleset: string;
  description?: string;
  tiles: Record<string, ContentTileDef>;
}
