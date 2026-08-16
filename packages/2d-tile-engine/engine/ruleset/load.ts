import type { LevelData } from "../types.js";
import { buildRulesetContext, RulesetContext } from "./RulesetContext.js";
import type { ContentPackDoc, RulesetDoc } from "./types.js";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load JSON: ${url} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function loadRuleset(url: string): Promise<RulesetDoc> {
  return fetchJson<RulesetDoc>(url);
}

export async function loadContentPack(url: string): Promise<ContentPackDoc> {
  return fetchJson<ContentPackDoc>(url);
}

/** Load ruleset + content pack for a level; returns null when ids are omitted. */
export async function resolveRulesetContext(
  level: LevelData,
  gamePackBaseUrl: string,
): Promise<RulesetContext | null> {
  const rulesetId = level.ruleset;
  const packId = level.contentPack;
  if (!rulesetId || !packId) {
    return null;
  }
  const base = gamePackBaseUrl.replace(/\/$/, "");
  const [ruleset, contentPack] = await Promise.all([
    loadRuleset(`${base}/rulesets/${rulesetId}.json`),
    loadContentPack(`${base}/content/${packId}.json`),
  ]);
  return buildRulesetContext(ruleset, contentPack);
}
