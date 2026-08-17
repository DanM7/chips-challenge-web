/**
 * Compare CC1 MS Bold times against the BitBusters level listing.
 * Source: https://scores.bitbusters.club/levels/cc1 (MS table, Bold column).
 *
 * Does not rewrite TWS dumps. Catalog/web files are patched only when a value changes.
 *
 * npx tsx packages/2d-tile-engine/scripts/syncBoldTimesFromListing.ts [from] [to]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(root, "../..");
const catalogPath = path.join(root, "integration/data/cc1-ms-bold-times.json");
const webSolDir = path.join(
  repoRoot,
  "apps/chips-challenge-web/public/games/chips-challenge-1/data/cc1-ms-solutions",
);
const LISTING_URL = "https://scores.bitbusters.club/levels/cc1";
const from = Number.parseInt(process.argv[2] ?? "41", 10);
const to = Number.parseInt(process.argv[3] ?? "149", 10);

function parseMsBoldTable(html: string): Array<{
  level: number;
  title: string;
  timeLimit: number | null;
  bold: number;
  publicTime: number;
  isTChip: boolean;
}> {
  const lynxStart = html.search(/View top scores for CC1 Lynx/i);
  const slice = html.slice(0, lynxStart >= 0 ? lynxStart : html.length);
  const rows: Array<{
    level: number;
    title: string;
    timeLimit: number | null;
    bold: number;
    publicTime: number;
    isTChip: boolean;
  }> = [];
  const rowRe =
    /<strong>(\d+)<\/strong><\/td><td data-order="([^"]+)"><a href="\/levels\/cc1\/\d+\/ms">[\s\S]*?<\/a><\/td><td[^>]*data-order="([^"]+)"[\s\S]*?<\/td><td[^>]*data-order="([^"]+)"[\s\S]*?<\/td><td[^>]*data-order="([^"]+)"[\s\S]*?<\/td><td[^>]*data-order="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(slice)) !== null) {
    const level = Number.parseInt(m[1]!, 10);
    if (level < 1 || level > 149) continue;
    const title = m[2]!.trim();
    const timeOrder = Number.parseInt(m[3]!, 10);
    const bold = Number.parseInt(m[5]!, 10);
    const publicTime = Number.parseInt(m[6]!, 10);
    if (!Number.isFinite(bold)) continue;
    // Untimed / T-Chip rows use 0 or 999/1000 in the Time column.
    const isTChip = !Number.isFinite(timeOrder) || timeOrder === 0 || timeOrder >= 999;
    rows.push({
      level,
      title,
      timeLimit: isTChip ? null : timeOrder,
      bold,
      publicTime: Number.isFinite(publicTime) ? publicTime : bold,
      isTChip,
    });
  }
  return rows;
}

const res = await fetch(LISTING_URL, {
  headers: { "User-Agent": "chips-challenge-web-cc1-sync/1.0" },
});
if (!res.ok) {
  throw new Error(`${LISTING_URL} → ${res.status}`);
}
const html = await res.text();
const scraped = parseMsBoldTable(html);
if (scraped.length < 140) {
  throw new Error(`Parsed ${scraped.length} MS rows (expected 149)`);
}

const catalogRaw = fs.readFileSync(catalogPath, "utf8");
const catalog = JSON.parse(catalogRaw) as {
  syncedFrom?: string;
  syncedAt?: string;
  levels: Array<{
    level: number;
    confirmedTimeRemaining: number;
    isTChip: boolean;
  }>;
};

const byLevel = new Map(scraped.map((r) => [r.level, r]));
const diffs: string[] = [];
for (const entry of catalog.levels) {
  if (entry.level < from || entry.level > to) continue;
  const live = byLevel.get(entry.level);
  if (!live) {
    diffs.push(`${entry.level}: missing from listing`);
    continue;
  }
  if (entry.confirmedTimeRemaining !== live.bold) {
    diffs.push(
      `${entry.level} ${live.title}: catalog ${entry.confirmedTimeRemaining} → listing bold ${live.bold}${live.isTChip ? " (T-Chip)" : ""}`,
    );
    entry.confirmedTimeRemaining = live.bold;
  }
  if (entry.isTChip !== live.isTChip) {
    diffs.push(
      `${entry.level} ${live.title}: catalog isTChip ${entry.isTChip} → listing ${live.isTChip}`,
    );
    entry.isTChip = live.isTChip;
  }
}

let webPatches = 0;
for (const live of scraped) {
  if (live.level < from || live.level > to) continue;
  const webPath = path.join(webSolDir, `level-${String(live.level).padStart(3, "0")}.json`);
  if (!fs.existsSync(webPath)) continue;
  const web = JSON.parse(fs.readFileSync(webPath, "utf8")) as Record<string, unknown>;
  const timeLimitSeconds = live.isTChip ? null : (live.timeLimit ?? web.timeLimitSeconds ?? null);
  const minChipMoves =
    !live.isTChip && timeLimitSeconds != null && typeof timeLimitSeconds === "number"
      ? timeLimitSeconds - live.bold
      : live.isTChip
        ? null
        : (web.minChipMoves ?? null);
  const next = {
    ...web,
    title: live.title,
    timeLimitSeconds,
    boldTimeRemaining: live.bold,
    minChipMoves,
    source: `https://scores.bitbusters.club/levels/cc1/${live.level}/ms`,
  };
  const changed =
    web.boldTimeRemaining !== next.boldTimeRemaining ||
    web.title !== next.title ||
    web.timeLimitSeconds !== next.timeLimitSeconds ||
    web.minChipMoves !== next.minChipMoves;
  if (changed) {
    fs.writeFileSync(webPath, `${JSON.stringify(next, null, 2)}\n`);
    webPatches += 1;
    diffs.push(
      `${live.level} ${live.title}: web bold ${String(web.boldTimeRemaining)} → ${live.bold}`,
    );
  }
}

const today = new Date().toISOString().slice(0, 10);
let catalogOut = catalogRaw
  .replace(
    /"syncedFrom": "[^"]*"/,
    `"syncedFrom": "${LISTING_URL} (MS Bold column; ${from}–${to} rechecked ${today})"`,
  )
  .replace(/"syncedAt": "[^"]*"/, `"syncedAt": "${today}"`);
for (const entry of catalog.levels) {
  if (entry.level < from || entry.level > to) continue;
  catalogOut = catalogOut.replace(
    new RegExp(`(\\{\\s*"level":\\s*${entry.level},\\s*"confirmedTimeRemaining":\\s*)\\d+`),
    `$1${entry.confirmedTimeRemaining}`,
  );
}
if (catalogOut !== catalogRaw) {
  fs.writeFileSync(catalogPath, catalogOut);
}

console.log(`Parsed ${scraped.length} MS listing rows; compared levels ${from}–${to}`);
console.log(`Web files patched: ${webPatches} (engine TWS dumps left untouched)`);
if (diffs.length) {
  console.log("Diffs:");
  for (const line of diffs) console.log(`  ${line}`);
} else {
  console.log("Catalog and web Auto Play files already matched listing Bold times in range.");
}
