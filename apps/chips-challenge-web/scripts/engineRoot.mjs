import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const repoRoot = path.join(appRoot, "../..");

/** In-repo engine package (`packages/2d-tile-engine`). */
export function getEngineRoot() {
  return path.join(repoRoot, "packages", "2d-tile-engine");
}
