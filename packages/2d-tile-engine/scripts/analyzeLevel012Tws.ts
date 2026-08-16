import { readFileSync } from "fs";
const sol = JSON.parse(
  readFileSync("integration/data/cc1-ms-solutions/level-012.json", "utf8"),
);
const recs = sol.twsRecords;
console.log({
  count: recs.length,
  first: recs[0],
  last: recs[recs.length - 1],
});
let prev = 0;
let waitTotal = 0;
const gaps: { tick: number; gap: number; dir: string }[] = [];
for (const r of recs) {
  const gap = Math.max(0, r.tick - prev - 1);
  waitTotal += gap + 1;
  if (gap > 0) gaps.push({ tick: r.tick, gap, dir: r.dir });
  prev = r.tick;
}
console.log({
  waitTotal,
  chipMoves: recs.length,
  nonZeroGaps: gaps.length,
  maxGap: gaps.length ? Math.max(...gaps.map((g) => g.gap)) : 0,
  sampleGaps: gaps.slice(0, 20),
});
