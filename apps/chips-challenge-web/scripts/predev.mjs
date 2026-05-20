import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getGeneratedDir, getRepoRoot, resolveInstallFile } from "./cc1Paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = getRepoRoot();

await import("./ensureVendor.mjs");

const tiles = path.join(getGeneratedDir(), "tiles.png");

function runRepoScript(script) {
  const r = spawnSync("npm", ["run", script], { cwd: repoRoot, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (resolveInstallFile("CHIPS.EXE") && !fs.existsSync(tiles)) {
  console.log("Generating tiles.png (first run)…");
  runRepoScript("ms:extract");
}

if (resolveInstallFile("CHIPS.DAT")) {
  runRepoScript("dat:levels");
}

if (!fs.existsSync(tiles)) {
  console.warn("tiles.png not found — dev server will start, but the game needs: npm run ms:extract");
}
