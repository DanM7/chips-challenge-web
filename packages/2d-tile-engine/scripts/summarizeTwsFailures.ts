#!/usr/bin/env node
/** Summarize TWS replay failure reasons across a level range. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const report = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../integration/data/batch-verify-report-5-149.json"), "utf8"),
);

const buckets = new Map<string, number>();
const examples: Record<string, number[]> = {};

for (const row of report.levels) {
  if (row.tws.status !== "fail") continue;
  const msg = row.tws.deathMessage ?? (row.tws.completed ? "incomplete" : "stuck");
  buckets.set(msg, (buckets.get(msg) ?? 0) + 1);
  if (!examples[msg]) examples[msg] = [];
  if (examples[msg].length < 5) examples[msg].push(row.level);
}

console.log("TWS failure breakdown (levels 5-149):");
for (const [msg, count] of [...buckets.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count}\t${msg}\t(e.g. ${examples[msg].join(", ")})`);
}
