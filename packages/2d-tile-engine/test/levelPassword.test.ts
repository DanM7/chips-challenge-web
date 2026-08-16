import { describe, expect, it } from "vitest";
import type { OriginalLevelReferenceDoc } from "../engine/types.js";
import {
  levelNumberFromLevelId,
  resolveDefaultLaunchLevelNumber,
  resolveLevelNumberFromPassword,
  resolvePasswordForLevelNumber,
} from "../engine/levelPassword.js";

const doc: OriginalLevelReferenceDoc = {
  schemaVersion: 1,
  description: "test",
  levelCount: 2,
  levels: [
    {
      number: 1,
      title: "Lesson 1",
      passwordMs: "BDHP",
      passwordLynx: "BDHP",
      timeLimitSeconds: 100,
      boldTargetMs: 83,
      boldTargetLynx: 82,
    },
    {
      number: 2,
      title: "Lesson 2",
      passwordMs: "JXMJ",
      passwordLynx: "JXMJ",
      timeLimitSeconds: 100,
      boldTargetMs: 90,
      boldTargetLynx: 89,
    },
  ],
};

describe("levelNumberFromLevelId", () => {
  it("parses level-NNN ids", () => {
    expect(levelNumberFromLevelId("level-008")).toBe(8);
    expect(levelNumberFromLevelId("level-001")).toBe(1);
    expect(levelNumberFromLevelId("bad")).toBeNull();
  });
});

describe("resolveDefaultLaunchLevelNumber", () => {
  it("uses levels index defaultLevelId", () => {
    expect(
      resolveDefaultLaunchLevelNumber({ defaultLevelId: "level-003", levels: [] }),
    ).toBe(3);
  });

  it("falls back when index is missing", () => {
    expect(resolveDefaultLaunchLevelNumber(null)).toBe(1);
  });
});

describe("resolvePasswordForLevelNumber", () => {
  it("returns the MS password for a level", () => {
    expect(resolvePasswordForLevelNumber(doc, 2)).toBe("JXMJ");
  });
});

describe("resolveLevelNumberFromPassword", () => {
  it("resolves MS passwords case-insensitively", () => {
    expect(resolveLevelNumberFromPassword(doc, "JXMJ")).toBe(2);
    expect(resolveLevelNumberFromPassword(doc, "jxmj")).toBe(2);
    expect(resolveLevelNumberFromPassword(doc, "BDHP")).toBe(1);
  });

  it("returns null for unknown or invalid passwords", () => {
    expect(resolveLevelNumberFromPassword(doc, "ZZZZ")).toBeNull();
    expect(resolveLevelNumberFromPassword(doc, "AB")).toBeNull();
    expect(resolveLevelNumberFromPassword(doc, "")).toBeNull();
  });
});
