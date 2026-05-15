import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await import("./ensureVendor.mjs");

const vendor = path.join(root, "vendor", "chips-challenge-ms");
const dat = path.join(vendor, "CHIPS.DAT");
const tiles = path.join(vendor, "generated", "tiles.png");

if (fs.existsSync(path.join(vendor, "CHIPS.EXE")) && !fs.existsSync(tiles)) {
  const r = spawnSync("npm", ["run", "ms:extract"], { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (fs.existsSync(dat)) {
  const levelJson = path.join(root, "public", "games", "chips-challenge-100", "levels", "level-001.json");
  const r = spawnSync(
    "npm",
    ["run", "dat:level1"],
    { cwd: root, stdio: "inherit", shell: true },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}
