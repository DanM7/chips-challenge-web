/**
 * Copy MS tile sheet (+ optional SFX) into public/ for production builds.
 * Vite copies public/ → dist/ so preview and static deploy are self-contained.
 *
 * Requires one local `npm run ms:extract` (or vendor/generated/tiles.png).
 * Set CC1_DEPLOY_STRICT=1 to fail the build when tiles are missing.
 */
import fs from "fs";
import path from "path";
import {
  describeInstallConfig,
  getAppRoot,
  getGeneratedDir,
  resolveInstallFile,
} from "./cc1Paths.mjs";

const AUDIO_LEAVES = [
  "BLIP2.WAV",
  "DOOR.WAV",
  "OOF3.WAV",
  "POP2.WAV",
  "WATER2.WAV",
  "TELEPORT.WAV",
  "BUMMER.WAV",
];

const appRoot = getAppRoot();
const outAssets = path.join(appRoot, "public", "ms-assets");
const outAudio = path.join(appRoot, "public", "ms-audio");

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const generated = getGeneratedDir();
const tilesPng = path.join(generated, "tiles.png");
const tilesJson = path.join(generated, "tiles.json");

if (!fs.existsSync(tilesPng)) {
  console.error(
    "MS tiles missing for deploy bundle.\n" +
      `  Expected: ${tilesPng}\n` +
      "  Run: npm run ms:extract (needs CHIPS.EXE via cc1-install.local.json)\n" +
      `  Install: ${describeInstallConfig()}`,
  );
  if (process.env.CC1_DEPLOY_STRICT === "1") {
    process.exit(1);
  }
  process.exit(0);
}

copyFile(tilesPng, path.join(outAssets, "tiles.png"));
if (fs.existsSync(tilesJson)) {
  copyFile(tilesJson, path.join(outAssets, "tiles.json"));
}
console.log(`Deploy assets: ${outAssets}/tiles.png`);

let audioCopied = 0;
for (const leaf of AUDIO_LEAVES) {
  const src = resolveInstallFile(leaf);
  if (!src) continue;
  const dest = path.join(outAudio, path.basename(src));
  copyFile(src, dest);
  audioCopied++;
}
if (audioCopied > 0) {
  console.log(`Deploy audio: ${audioCopied} file(s) → public/ms-audio/`);
} else {
  console.warn(
    "No MS audio copied (game is playable; SFX need install folder or CC1_MS_INSTALL).",
  );
}
