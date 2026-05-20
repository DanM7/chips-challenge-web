import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const pipelineRoot = path.resolve(appRoot, "../../../cc1-asset-extraction-pipeline");
const extractScript = path.join(pipelineRoot, "tools/extraction/extractMsDigits.ts");

if (!fs.existsSync(extractScript)) {
  console.error(`cc1-asset-extraction-pipeline not found at ${pipelineRoot}`);
  process.exit(1);
}

const tsxBin = path.join(pipelineRoot, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const useLocalTsx = fs.existsSync(tsxBin);
const result = useLocalTsx
  ? spawnSync(tsxBin, [extractScript], { cwd: pipelineRoot, stdio: "inherit", shell: true })
  : spawnSync("npx", ["tsx", extractScript], { cwd: pipelineRoot, stdio: "inherit", shell: true });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
