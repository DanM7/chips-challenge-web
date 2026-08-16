import { readFileSync } from "node:fs";
import { expandLayer } from "../engine/levelLayers.js";

const raw = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-018.json",
    "utf8",
  ),
);

const cellCount = 32 * 32;
const upper = expandLayer(raw.layers.upper, cellCount);
const lower = expandLayer(raw.layers.lower, cellCount);
console.log("upper len", upper.length, "lower len", lower.length);
console.log("upper tiles raw len", raw.layers.upper.tiles.length);
console.log("lower prefix+tiles", raw.layers.lower.emptyPrefix, raw.layers.lower.tiles.length);

// Find chip tiles
for (let i = 0; i < cellCount; i++) {
  if (upper[i]?.startsWith("chip_") || lower[i]?.startsWith("chip_")) {
    console.log("chip at", i % 32, Math.floor(i / 32), "U", upper[i], "L", lower[i]);
  }
}

// Connectivity from start treating wall as blocked
const start = { x: 5, y: 30 };
const blocked = new Set(["wall", "blocked_n", "blocked_s", "blocked_e", "blocked_w", "blocked_se", "blocked_sw", "blocked_ne", "blocked_nw", "block_movable", "block_blue_wall", "water", "fire", "bomb"]);
// Actually blue walls are passable in MS!
const blocked2 = new Set(["wall", "blocked_n", "blocked_s", "blocked_e", "blocked_w", "blocked_se", "blocked_sw", "blocked_ne", "blocked_nw", "block_movable", "water", "fire", "bomb"]);

function composite(x, y) {
  const i = y * 32 + x;
  return upper[i] !== "empty" ? upper[i] : lower[i];
}

function bfs(passBlue) {
  const blockSet = passBlue ? blocked2 : blocked;
  const seen = new Set();
  const q = [start];
  seen.add("5,30");
  while (q.length) {
    const { x, y } = q.shift();
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= 32 || ny >= 32) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      const t = composite(nx, ny);
      if (blockSet.has(t)) continue;
      // chip marker ok
      seen.add(key);
      q.push({ x: nx, y: ny });
    }
  }
  return seen;
}

const s1 = bfs(false);
const s2 = bfs(true);
console.log("reachable ignoring blue as wall", s1.size, [...s1].sort().join(" "));
console.log("reachable treating blue as passable", s2.size, "has flippers cell", s2.has("28,1"), "has exit", s2.has("23,24"));

// What if (4,29) were open?
const s3 = new Set(["5,30"]);
const q = [{ x: 5, y: 30 }];
const extraOpen = new Set(["4,29"]);
while (q.length) {
  const { x, y } = q.shift();
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]) {
    const nx = x + dx,
      ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= 32 || ny >= 32) continue;
    const key = `${nx},${ny}`;
    if (s3.has(key)) continue;
    const t = composite(nx, ny);
    if (extraOpen.has(key) || !blocked2.has(t) || t?.startsWith("chip")) {
      if (blocked2.has(t) && !extraOpen.has(key) && !t?.startsWith("chip")) continue;
      s3.add(key);
      q.push({ x: nx, y: ny });
    }
  }
}
console.log("if 4,29 open: reach", s3.size, "flippers approach 27,1", s3.has("27,1"), "exit", s3.has("23,24"));

// What if bottom corridor (0-6,30) more open - (1,30)(2,30)(3,30) empty?
const s4 = new Set(["5,30"]);
const q4 = [{ x: 5, y: 30 }];
const open4 = new Set(["1,30", "2,30", "3,30"]);
while (q4.length) {
  const { x, y } = q4.shift();
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]) {
    const nx = x + dx,
      ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= 32 || ny >= 32) continue;
    const key = `${nx},${ny}`;
    if (s4.has(key)) continue;
    const t = composite(nx, ny);
    if (open4.has(key)) {
      s4.add(key);
      q4.push({ x: nx, y: ny });
      continue;
    }
    if (blocked2.has(t) && !t?.startsWith("chip")) continue;
    s4.add(key);
    q4.push({ x: nx, y: ny });
  }
}
console.log("if 1-3,30 open: reach", s4.size, "2,29", s4.has("2,29"), "flippers", s4.has("27,1"));
