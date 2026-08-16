import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Use compiled? Prefer loading via dynamic import of ts - just parse JSON layers directly.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
    ),
    "utf8",
  ),
);

const upper = level.layers?.upper ?? level.upper;
const lower = level.layers?.lower ?? level.lower;
const w = level.width ?? 32;
const h = level.height ?? 32;

function tileAt(x, y) {
  const i = y * w + x;
  const u = upper?.[i] ?? "empty";
  const l = lower?.[i] ?? "empty";
  if (u && u !== "empty") return u;
  return l || "empty";
}

const map = {
  wall: "#",
  floor: ".",
  chip: "*",
  key_yellow: "Y",
  key_blue: "B",
  key_red: "R",
  key_green: "G",
  door_yellow: "y",
  door_blue: "b",
  door_red: "r",
  door_green: "g",
  socket: "S",
  exit: "E",
  hint: "H",
  empty: " ",
  chip_n: "C",
};

for (let y = 8; y <= 22; y++) {
  let row = "";
  for (let x = 8; x <= 22; x++) {
    const t = tileAt(x, y);
    row += map[t] ?? t[0];
  }
  console.log(String(y).padStart(2), row);
}
console.log("   " + "890123456789012".split("").join(""));
console.log("   " + "888999999999900".split("").join(""));
console.log("start", level.start ?? level.chipStart);
