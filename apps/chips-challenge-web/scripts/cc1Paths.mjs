import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const repoRoot = path.join(__dirname, "..", "..", "..");

/** Committed game pack under public/games/ (must match manifest.json id). */
export const GAME_PACK_ID = "chips-challenge-1";
const bundledVendor = path.join(appRoot, "vendor", "chips-challenge-ms");
const generatedDir = path.join(bundledVendor, "generated");

const LOCAL_CONFIG = path.join(repoRoot, "cc1-install.local.json");

function readLocalInstallPath() {
  if (!fs.existsSync(LOCAL_CONFIG)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(LOCAL_CONFIG, "utf8"));
    const raw = data?.installPath;
    return typeof raw === "string" && raw.trim() ? path.resolve(raw.trim()) : null;
  } catch (err) {
    console.error(`Could not parse ${LOCAL_CONFIG}: ${err instanceof Error ? err.message : err}`);
    console.error("Use forward slashes in installPath, e.g. C:/games/Chips_Challenge_1");
    return null;
  }
}

/** Licensed CHIPS.DAT / CHIPS.EXE / audio — external install or bundled vendor/. */
export function getInstallDir() {
  if (process.env.CC1_MS_INSTALL?.trim()) {
    return path.resolve(process.env.CC1_MS_INSTALL.trim());
  }
  const fromFile = readLocalInstallPath();
  if (fromFile) return fromFile;
  return bundledVendor;
}

/** Generated tiles (gitignored); always under the app vendor tree. */
export function getGeneratedDir() {
  return generatedDir;
}

export function getAppRoot() {
  return appRoot;
}

/** Absolute path: `public/games/<GAME_PACK_ID>/`. */
export function getGamePackDir(...segments) {
  return path.join(appRoot, "public", "games", GAME_PACK_ID, ...segments);
}

/** URL path: `/games/<GAME_PACK_ID>/...`. */
export function getGamePackUrl(...segments) {
  const tail = segments.length ? `/${segments.join("/")}` : "";
  return `/games/${GAME_PACK_ID}${tail}`;
}

export function getRepoRoot() {
  return repoRoot;
}

export function getBundledVendorDir() {
  return bundledVendor;
}

export function usesExternalInstall() {
  if (process.env.CC1_MS_INSTALL?.trim()) return true;
  return readLocalInstallPath() !== null;
}

function resolveInDir(dir, ...names) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const byLower = new Map(entries.filter((e) => e.isFile()).map((e) => [e.name.toLowerCase(), e.name]));
  for (const name of names) {
    const hit = byLower.get(name.toLowerCase());
    if (hit) return path.join(dir, hit);
  }
  return null;
}

/** Find CHIPS.EXE / CHIPS.DAT in the install folder or one subdirectory deep. */
export function resolveInstallFile(...names) {
  const dir = getInstallDir();
  const direct = resolveInDir(dir, ...names);
  if (direct) return direct;
  if (!fs.existsSync(dir)) return null;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const nested = resolveInDir(path.join(dir, ent.name), ...names);
    if (nested) return nested;
  }
  return null;
}

export function describeInstallConfig() {
  if (process.env.CC1_MS_INSTALL?.trim()) {
    return `CC1_MS_INSTALL=${process.env.CC1_MS_INSTALL.trim()}`;
  }
  if (readLocalInstallPath()) return `cc1-install.local.json → ${readLocalInstallPath()}`;
  return `bundled vendor (${bundledVendor})`;
}
