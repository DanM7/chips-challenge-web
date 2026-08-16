#!/usr/bin/env node
/**
 * Sync CC1 MS bold time remaining from scores.bitbusters.club into per-level solution files.
 *
 * Usage: node scripts/syncBitBustersSolutions.mjs [startLevel] [endLevel]
 */
import { readLevelSolution, writeLevelSolution } from "./solutionStorage.mjs";

const startLevel = Number.parseInt(process.argv[2] ?? "1", 10);
const endLevel = Number.parseInt(process.argv[3] ?? "149", 10);

async function fetchLevelMeta(levelNumber) {
  const url = `https://scores.bitbusters.club/levels/cc1/${levelNumber}/ms`;
  const res = await fetch(url, {
    headers: { "User-Agent": "2d-tile-engine-cc1-integration/1.0" },
  });
  if (!res.ok) {
    throw new Error(`${url} → ${res.status}`);
  }
  const html = await res.text();

  const timeLimitMatch =
    /Time limit:\s*<span[^>]*>(\d+)<\/span>/i.exec(html) ??
    /Time limit:\s*(\d+)/i.exec(html);
  const publicTimeMatch =
    /Public time:\s*<span[^>]*>(\d+)<\/span>/i.exec(html) ??
    /Public time:\s*(\d+)/i.exec(html);
  const titleMatch = new RegExp(`CC1 level #${levelNumber}:\\s*([^<]+)`, "i").exec(html);

  if (!timeLimitMatch || !publicTimeMatch) {
    return null;
  }

  const timeLimitSeconds = Number.parseInt(timeLimitMatch[1], 10);
  const boldTimeRemaining = Number.parseInt(publicTimeMatch[1], 10);
  const minChipMoves = timeLimitSeconds - boldTimeRemaining;

  return {
    url,
    title: titleMatch?.[1]?.trim() ?? null,
    timeLimitSeconds,
    boldTimeRemaining,
    minChipMoves,
  };
}

for (let n = startLevel; n <= endLevel; n++) {
  try {
    const meta = await fetchLevelMeta(n);
    if (!meta) {
      console.warn(`Level ${n}: could not parse bold metadata`);
      continue;
    }
    const existing = readLevelSolution(n) ?? {
      levelId: `level-${String(n).padStart(3, "0")}`,
      moves: null,
    };
    writeLevelSolution(n, {
      ...existing,
      levelId: existing.levelId ?? `level-${String(n).padStart(3, "0")}`,
      timeLimitSeconds: meta.timeLimitSeconds,
      boldTimeRemaining: meta.boldTimeRemaining,
      minChipMoves: meta.minChipMoves,
      source: meta.url,
      title: meta.title,
      syncedAt: new Date().toISOString(),
    });
    console.log(
      `Level ${n}: bold ${meta.boldTimeRemaining}s / ${meta.timeLimitSeconds}s (≤${meta.minChipMoves} chip-moves)`,
    );
    await new Promise((r) => setTimeout(r, 150));
  } catch (error) {
    console.warn(`Level ${n}: ${error instanceof Error ? error.message : error}`);
  }
}

console.log("Sync complete.");
