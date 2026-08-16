#!/usr/bin/env node
/** Download CC1-ms.dac.tws (all 149 MS solutions) from Bit Busters forum. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destDir = path.join(__dirname, "../.tmp/tws");
const dest = path.join(destDir, "CC1-ms.dac.tws");
const url = "https://forum.bitbusters.club/attachment.php?aid=756";

fs.mkdirSync(destDir, { recursive: true });
const res = await fetch(url, {
  headers: { "User-Agent": "2d-tile-engine-cc1-integration/1.0" },
});
if (!res.ok) {
  console.error(`Download failed: ${res.status} ${url}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(dest, buf);
console.log(`Wrote ${dest} (${buf.length} bytes)`);
