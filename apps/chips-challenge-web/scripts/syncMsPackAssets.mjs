/**
 * Copy MS tile sheet (+ optional SFX) into the committed game pack.
 * Run after `npm run ms:extract` when tiles or audio change (infrequent).
 *
 *   npm run sync:ms-pack
 *   git add apps/chips-challenge-web/public/games/chips-challenge-1/sprites/ms-tiles.*
 *   git add apps/chips-challenge-web/public/games/chips-challenge-1/audio/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  describeInstallConfig,
  getAppRoot,
  getGamePackDir,
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

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function resolveTilesSource(appRoot) {
  const generated = path.join(getGeneratedDir(), "tiles.png");
  if (fs.existsSync(generated)) return generated;
  const legacy = path.join(appRoot, "public", "ms-assets", "tiles.png");
  if (fs.existsSync(legacy)) return legacy;
  return null;
}

function resolveTilesJsonSource(appRoot, tilesPng) {
  const generated = path.join(getGeneratedDir(), "tiles.json");
  if (fs.existsSync(generated)) return generated;
  const legacy = path.join(appRoot, "public", "ms-assets", "tiles.json");
  if (fs.existsSync(legacy)) return legacy;
  const sidecar = tilesPng.replace(/\.png$/i, ".json");
  return fs.existsSync(sidecar) ? sidecar : null;
}

const appRoot = getAppRoot();
const tilesSrc = resolveTilesSource(appRoot);
if (!tilesSrc) {
  console.error(
    "MS tiles missing.\n" +
      "  Run: npm run ms:extract (needs CHIPS.EXE via cc1-install.local.json)\n" +
      `  Install: ${describeInstallConfig()}`,
  );
  process.exit(process.env.CC1_SYNC_STRICT === "1" ? 1 : 0);
}

const outPng = getGamePackDir("sprites", "ms-tiles.png");
copyFile(tilesSrc, outPng);
console.log(`Game pack: ${outPng}`);

const jsonSrc = resolveTilesJsonSource(appRoot, tilesSrc);
if (jsonSrc) {
  const outJson = getGamePackDir("sprites", "ms-tiles.json");
  copyFile(jsonSrc, outJson);
  console.log(`Game pack: ${outJson}`);
}

const outAudioDir = getGamePackDir("audio");
let audioCopied = 0;
for (const leaf of AUDIO_LEAVES) {
  const legacy = path.join(appRoot, "public", "ms-audio", leaf);
  const src = fs.existsSync(legacy) ? legacy : resolveInstallFile(leaf);
  if (!src) continue;
  copyFile(src, path.join(outAudioDir, path.basename(src)));
  audioCopied++;
}
if (audioCopied > 0) {
  console.log(`Game pack audio: ${audioCopied} file(s) → ${outAudioDir}/`);
} else {
  console.warn("No MS audio copied (optional; needs install folder or CC1_MS_INSTALL).");
}
