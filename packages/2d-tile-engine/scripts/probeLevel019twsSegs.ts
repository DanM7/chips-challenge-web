import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { direction: number }[] };
const TWS_DIR = ["U", "L", "D", "R"] as const;
const letters = sol.twsRecords.map((r) => TWS_DIR[r.direction]!);

function compress(ls: string[], start = 0, end = ls.length): string {
  let out = "";
  let i = start;
  while (i < end) {
    let j = i;
    while (j < end && ls[j] === ls[i]) j++;
    const n = j - i;
    out += (n > 1 ? String(n) : "") + ls[i];
    i = j;
  }
  return out;
}

console.log("0-50", compress(letters, 0, 50));
console.log("50-100", compress(letters, 50, 100));
console.log("100-150", compress(letters, 100, 150));
console.log("150-200", compress(letters, 150, 200));
console.log("200-250", compress(letters, 200, 250));
console.log("250-300", compress(letters, 250, 300));
console.log("300-346", compress(letters, 300, 346));
console.log("\nraw 50-80:", letters.slice(50, 80).join(""));
console.log("raw 60-75:", letters.slice(60, 75).join(""));
