import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAppRoot, getGamePackDir, resolveInstallFile } from "./cc1Paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = getAppRoot();
const pipelineRoot = path.resolve(appRoot, "../../../cc1-asset-extraction-pipeline");

/** Parse args like `1`, `41-149`, `1-149` into sorted unique level numbers. */
function parseLevelArgs(argv) {
  const out = new Set();
  for (const arg of argv) {
    const range = /^(\d+)-(\d+)$/.exec(arg);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
        console.error(`Invalid range: ${arg}`);
        process.exit(1);
      }
      for (let n = start; n <= end; n++) {
        out.add(n);
      }
      continue;
    }
    const n = Number(arg);
    if (Number.isFinite(n) && n >= 1) {
      out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

const levels = parseLevelArgs(process.argv.slice(2));
if (levels.length === 0) {
  console.error("Usage: node runDatLevel.mjs <n> [m] [start-end] …  (e.g. 41-149 or 1-149)");
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

const levelsDir = getGamePackDir("levels");

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
