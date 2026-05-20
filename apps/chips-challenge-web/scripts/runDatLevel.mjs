import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAppRoot, resolveInstallFile } from "./cc1Paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = getAppRoot();
const pipelineRoot = path.resolve(appRoot, "../../../cc1-asset-extraction-pipeline");

const levels = process.argv.slice(2).map((n) => Number(n)).filter((n) => n >= 1);
if (levels.length === 0) {
  console.error("Usage: node runDatLevel.mjs <levelNumber> [levelNumber...]");
  process.exit(1);
}

const dat = resolveInstallFile("CHIPS.DAT");
if (!dat) {
  console.error("CHIPS.DAT not found. Set cc1-install.local.json or CC1_MS_INSTALL.");
  process.exit(1);
}

if (!fs.existsSync(path.join(pipelineRoot, "package.json"))) {
  console.error(`cc1-asset-extraction-pipeline not found at ${pipelineRoot}`);
  process.exit(1);
}

const levelsDir = path.join(appRoot, "public", "games", "chips-challenge-100", "levels");

for (const levelNum of levels) {
  const output = path.join(levelsDir, `level-${String(levelNum).padStart(3, "0")}.json`);
  const result = spawnSync(
    "npm",
    ["run", "dat-to-json", "--", dat, output, "--level", String(levelNum)],
    { cwd: pipelineRoot, stdio: "inherit", shell: true },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await import("./syncLevelsIndex.mjs");
