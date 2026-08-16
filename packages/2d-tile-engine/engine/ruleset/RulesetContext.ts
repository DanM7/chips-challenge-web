import type { ContentPackDoc, ContentTileDef, RulesetDoc } from "./types.js";

/** Resolved ruleset + content pack for a level (presentation / future simulation). */
export class RulesetContext {
  constructor(
    readonly ruleset: RulesetDoc,
    readonly contentPack: ContentPackDoc,
    private readonly tileById: Map<string, ContentTileDef>,
  ) {}

  getTile(tileId: string): ContentTileDef | undefined {
    return this.tileById.get(tileId);
  }

  getArchetype(tileId: string): string | undefined {
    return this.tileById.get(tileId)?.archetype;
  }

  hasTag(tileId: string, tag: string): boolean {
    return this.tileById.get(tileId)?.tags?.includes(tag) ?? false;
  }

  /** Chips remaining required before this gate/goal tile can be used (from content params). */
  chipsRequiredAt(tileId: string): number | undefined {
    const params = this.tileById.get(tileId)?.params;
    if (params && typeof params.requiresChipsRemaining === "number") {
      return params.requiresChipsRemaining;
    }
    return undefined;
  }
}

export function buildRulesetContext(
  ruleset: RulesetDoc,
  contentPack: ContentPackDoc,
): RulesetContext {
  if (contentPack.ruleset !== ruleset.id) {
    throw new Error(
      `Content pack "${contentPack.id}" ruleset "${contentPack.ruleset}" does not match ruleset "${ruleset.id}"`,
    );
  }
  return new RulesetContext(ruleset, contentPack, new Map(Object.entries(contentPack.tiles)));
}
