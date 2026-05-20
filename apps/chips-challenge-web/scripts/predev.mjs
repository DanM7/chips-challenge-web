import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import {
  GAME_PACK_ID,
  getAppRoot,
  getGamePackDir,
  getGeneratedDir,
  getRepoRoot,
  resolveInstallFile,
} from "./cc1Paths.mjs";

const repoRoot = getRepoRoot();
const tiles = path.join(getGeneratedDir(), "tiles.png");
const levelsDir = getGamePackDir("levels");
const indexPath = path.join(levelsDir, "index.json");

function runRepoScript(script) {
  const r = spawnSync("npm", ["run", script], { cwd: repoRoot, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function shouldRegenerateLevels() {
  if (process.env.CC1_FORCE_DAT_EXPORT === "1") {
    return true;
  }
  const dat = resolveInstallFile("CHIPS.DAT");
  if (!dat) {
    return false;
  }
  if (!fs.existsSync(indexPath)) {
    return true;
  }
  const levelFiles = fs
    .readdirSync(levelsDir)
    .filter((name) => /^level-\d{3}\.json$/.test(name));
  if (levelFiles.length === 0) {
    return true;
  }
  const datMtime = fs.statSync(dat).mtimeMs;
  const newestLevelMtime = Math.max(
    ...levelFiles.map((name) => fs.statSync(path.join(levelsDir, name)).mtimeMs),
  );
  return datMtime > newestLevelMtime;
}

await import("./ensureVendor.mjs");

if (resolveInstallFile("CHIPS.EXE") && !fs.existsSync(tiles)) {
  console.log("Generating tiles.png (first run)…");
  runRepoScript("ms:extract");
}

if (shouldRegenerateLevels()) {
  console.log(`Exporting levels from CHIPS.DAT → public/games/${GAME_PACK_ID}/levels/ …`);
  runRepoScript("dat:levels");
} else if (resolveInstallFile("CHIPS.DAT")) {
  console.log(
    `Skipping dat:levels (CHIPS.DAT not newer than existing levels). Set CC1_FORCE_DAT_EXPORT=1 to force.`,
  );
}

if (!fs.existsSync(tiles)) {
  console.warn("tiles.png not found — dev server will start, but the game needs: npm run ms:extract");
}
