import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { getCompositeTile } from "../engine/levelRuntime.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

function expand(notation: string): Direction[] {
  const map: Record<string, Direction> = { U: "up", D: "down", L: "left", R: "right" };
  const out: Direction[] = [];
  for (const tok of notation.trim().split(/\s+/)) {
    const m = tok.match(/^(\d+)?([UDLR])$/);
    if (!m) throw new Error(tok);
    const n = m[1] ? Number.parseInt(m[1], 10) : 1;
    for (let i = 0; i < n; i++) out.push(map[m[2]!]!);
  }
  return out;
}

function blocks(level: LevelData) {
  const out: string[] = [];
  for (let y = 20; y < 32; y++) {
    for (let x = 10; x < 20; x++) {
      if (getCompositeTile(level, x, y) === "block_movable") out.push(`${x},${y}`);
    }
  }
  return out;
}

// Replay known opener to block room (from solver output)
// yellow+chip then to-blocks — reconstruct by replaying letters from a quick BFS print
const opener =
  // chip+yellow: from probe RRRR then path to key
  // From solver: yellow+chip mb=10, to-blocks mb=19 at 11,27
  // Let's discover by trying known StrategyWiki: after yellow lock hold E
  "";

// Print starting block room layout after manual path
const paths = [
  // GameFAQs: chip, yellow, lock, top, hold right
  "4R 4D U L 4U 5R 2U R", // guess
  "4R 4D U L 4U 4R 3U R",
  "RRRRDDDDU L UUUU RRRRR",
  "RRDDDD U L UUUUU RRRR", // bold yellow first then chip?
];

for (const p of paths) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  try {
    for (const d of expand(p)) {
      stepMsCc1Simulation(r, d);
      if (r.playerDied) break;
    }
  } catch {}
  console.log(
    p,
    `pos=${r.gx},${r.gy}`,
    `keys=${r.playerState.keys}`,
    `chips=${r.playerState.chipsRemainingOnMap}`,
    `died=${r.playerDied}`,
    r.deathMessage ?? "",
    "blocks",
    blocks(r.level).join(" "),
  );
}

// Dump walls/fake around force column
const r0 = createMsCc1SimulationRunner(structuredClone(level));
console.log("\nForce neighborhood tiles:");
for (let y = 20; y <= 29; y++) {
  let row = `${y}: `;
  for (let x = 5; x <= 16; x++) {
    const t = getCompositeTile(r0.level, x, y);
    const short =
      t === "empty"
        ? "."
        : t === "wall"
          ? "#"
          : t === "block_movable"
            ? "B"
            : t === "water"
              ? "~"
              : t.startsWith("force")
                ? "F"
                : t.startsWith("lock")
                  ? "D"
                  : t.startsWith("key")
                    ? "K"
                    : t === "chip"
                      ? "c"
                      : t === "chip_s"
                        ? "C"
                        : t.startsWith("fireball")
                          ? "*"
                          : t[0]!;
    row += short;
  }
  console.log(row);
}
