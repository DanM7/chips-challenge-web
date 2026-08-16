import { describe, expect, it } from "vitest";
import { buildRulesetContext } from "../engine/ruleset/RulesetContext.js";
import type { ContentPackDoc, RulesetDoc } from "../engine/ruleset/types.js";

const ruleset: RulesetDoc = { id: "grid-arcade-v1", systems: ["gates"] };
const pack: ContentPackDoc = {
  id: "ms-cc1",
  ruleset: "grid-arcade-v1",
  tiles: {
    exit: { archetype: "goal", params: { requiresChipsRemaining: 0 } },
    key_blue: { archetype: "collectible", tags: ["key"], params: { keyVariant: "blue" } },
  },
};

describe("RulesetContext", () => {
  it("resolves archetype and tags from content pack", () => {
    const ctx = buildRulesetContext(ruleset, pack);
    expect(ctx.getArchetype("exit")).toBe("goal");
    expect(ctx.hasTag("key_blue", "key")).toBe(true);
    expect(ctx.chipsRequiredAt("exit")).toBe(0);
  });

  it("rejects mismatched ruleset id", () => {
    expect(() =>
      buildRulesetContext(ruleset, { ...pack, ruleset: "other" }),
    ).toThrow(/does not match/);
  });
});
