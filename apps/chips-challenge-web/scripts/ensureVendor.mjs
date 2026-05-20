import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import {
  describeInstallConfig,
  getAppRoot,
  getBundledVendorDir,
  getGeneratedDir,
  getRepoRoot,
  resolveInstallFile,
  usesExternalInstall,
} from "./cc1Paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = getAppRoot();
const repoRoot = getRepoRoot();
const vendor = getBundledVendorDir();

const zipCandidates = [
  path.join(repoRoot, "chips_challenge.zip"),
  path.join(appRoot, "chips_challenge.zip"),
];

function extractZip(zipPath) {
  fs.mkdirSync(vendor, { recursive: true });
  const r = spawnSync("tar", ["-xf", zipPath, "-C", vendor], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`Failed to extract ${zipPath}`);
    return false;
  }
  console.log(`Extracted ${path.basename(zipPath)} → vendor/chips-challenge-ms/`);
  return true;
}

function moveRootDat(searchRoot) {
  for (const name of ["CCLP.dat", "cclp.dat", "CHIPS.DAT", "chips.dat"]) {
    const src = path.join(searchRoot, name);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(vendor, { recursive: true });
    const dest = path.join(vendor, "CHIPS.DAT");
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${path.join(path.basename(searchRoot), name)} → vendor/chips-challenge-ms/CHIPS.DAT`);
    }
  }
}

fs.mkdirSync(getGeneratedDir(), { recursive: true });

if (usesExternalInstall()) {
  const exe = resolveInstallFile("CHIPS.EXE");
  const dat = resolveInstallFile("CHIPS.DAT");
  console.log(`MS install: ${describeInstallConfig()}`);
  if (exe) console.log(`  CHIPS.EXE: ${exe}`);
  if (dat) console.log(`  CHIPS.DAT: ${dat}`);
  if (!exe && !dat) {
    console.warn("  No CHIPS.EXE or CHIPS.DAT found at that path.");
  }
} else {
  fs.mkdirSync(vendor, { recursive: true });
  if (!resolveInstallFile("CHIPS.DAT")) {
    for (const zipPath of zipCandidates) {
      if (fs.existsSync(zipPath) && extractZip(zipPath)) break;
    }
  }
  moveRootDat(repoRoot);
  moveRootDat(appRoot);

  if (!resolveInstallFile("CHIPS.DAT")) {
    console.warn("vendor/chips-challenge-ms/CHIPS.DAT not found.");
    console.warn(
      "Set installPath in cc1-install.local.json (see cc1-install.local.json.example), or drop chips_challenge.zip at the repo root.",
    );
  }
}
