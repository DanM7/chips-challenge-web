import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const repoRoot = path.join(appRoot, "../..");

/** Installed via `github:danm7/2d-tile-engine` (Netlify / CI). */
const fromNodeModules = path.join(repoRoot, "node_modules", "@danm7", "2d-tile-engine");

/** Optional sibling clone for local engine work (`file:../2d-tile-engine` override). */
const fromSibling = path.resolve(appRoot, "../../../2d-tile-engine");

/** Local sibling clone with unreleased engine APIs (e.g. moveIntent). */
function siblingEngineIsNewer() {
  return fs.existsSync(path.join(fromSibling, "engine", "moveIntent.ts"));
}

export function getEngineRoot() {
  if (siblingEngineIsNewer()) {
    return fromSibling;
  }
  if (fs.existsSync(path.join(fromNodeModules, "engine"))) {
    return fromNodeModules;
  }
  if (fs.existsSync(path.join(fromSibling, "engine"))) {
    return fromSibling;
  }
  return fromNodeModules;
}
