import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAppRoot } from "./cc1Paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levelsDir = path.join(getAppRoot(), "public", "games", "chips-challenge-1", "levels");
const indexPath = path.join(levelsDir, "index.json");

const files = fs
  .readdirSync(levelsDir)
  .filter((name) => /^level-\d{3}\.json$/.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const levels = files.map((filename) => {
  const id = filename.replace(/\.json$/, "");
  const raw = fs.readFileSync(path.join(levelsDir, filename), "utf8");
  const data = JSON.parse(raw);
  const name = data.name ?? data.metadata?.title ?? data.hud?.levelTitle ?? id;
  return {
    id,
    name,
    url: `/games/chips-challenge-1/levels/${filename}`,
  };
});

/** Preserve launch default from existing index.json only (see `resolveDefaultLaunchLevelNumber` in 2d-tile-engine for runtime fallback). */
let defaultLevelId;
if (fs.existsSync(indexPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    if (existing.defaultLevelId && levels.some((l) => l.id === existing.defaultLevelId)) {
      defaultLevelId = existing.defaultLevelId;
    }
  } catch {
    /* omit defaultLevelId */
  }
}

const index = defaultLevelId ? { levels, defaultLevelId } : { levels };
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`Wrote ${levels.length} level(s) → ${indexPath}`);
