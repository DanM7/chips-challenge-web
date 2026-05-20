import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describeInstallConfig, getAppRoot, getGeneratedDir, getInstallDir, resolveInstallFile } from "./cc1Paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = getAppRoot();
const pipelineRoot = path.resolve(appRoot, "../../../cc1-asset-extraction-pipeline");
const extractScript = path.join(pipelineRoot, "tools/extraction/extractMsTiles.ts");

console.log(`MS install (${describeInstallConfig()})`);
console.log(`Output tiles → ${getGeneratedDir()}`);

const chipsExe = resolveInstallFile("CHIPS.EXE");
if (!chipsExe) {
  console.error(`CHIPS.EXE not found under ${getInstallDir()} (also checked one subdirectory level).`);
  console.error(
    "Create cc1-install.local.json at the repo root (copy from cc1-install.local.json.example).",
  );
  console.error("Use forward slashes in JSON, e.g. \"installPath\": \"C:/games/Chips_Challenge_1\"");
  process.exit(1);
}
console.log(`  CHIPS.EXE: ${chipsExe}`);

if (!fs.existsSync(extractScript)) {
  console.error(`cc1-asset-extraction-pipeline not found at ${pipelineRoot}`);
  console.error("Clone it next to chips-challenge-web, then run npm install there.");
  process.exit(1);
}

const env = {
  ...process.env,
  CC1_PROJECT_ROOT: appRoot,
  CC1_MS_INSTALL: getInstallDir(),
  CC1_CHIPS_EXE: chipsExe,
};

// Windows .cmd shims require shell: true; without it spawnSync returns EINVAL and predev never reaches Vite.
const tsxBin = path.join(pipelineRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const useLocalTsx = fs.existsSync(tsxBin);
const result = useLocalTsx
  ? spawnSync(tsxBin, [extractScript], { cwd: pipelineRoot, env, stdio: "inherit", shell: true })
  : spawnSync("npx", ["tsx", extractScript], { cwd: pipelineRoot, env, stdio: "inherit", shell: true });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
