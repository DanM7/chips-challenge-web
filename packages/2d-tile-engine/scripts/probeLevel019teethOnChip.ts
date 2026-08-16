import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const level = JSON.parse(
  readFileSync(
    path.join(
      root,
      "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-019.json",
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);
const sol = JSON.parse(
  readFileSync(path.join(root, "integration/data/cc1-ms-solutions/level-019.json"), "utf8"),
) as { twsRecords: { direction: number }[] };
const TWS_DIR: Direction[] = ["up", "left", "down", "right"];
const dirs = sol.twsRecords
  .map((r) => TWS_DIR[r.direction])
  .filter((d): d is Direction => !!d);

function sim(label: string, patchChipsAsWall: boolean) {
  const r = createMsCc1SimulationRunner(structuredClone(level));
  r.buttonPressCtx.stepParity = "odd";
  if (patchChipsAsWall) {
    // Monkeypatch via wrapping canMonsterEnter is hard; instead mark all chips as
    // temporary walls by... we can't easily. Use chipIgnores no.
    // Instead: convert all chip tiles to gravel (blocks teeth) but then Chip can't collect.
    // Better approach below - just run and report.
  }
  let diedAt = -1;
  for (let i = 0; i < dirs.length; i++) {
    const mBefore = r.monsters.filter((m) => m.alive).map((m) => `${m.x},${m.y}`);
    stepMsCc1Simulation(r, dirs[i]!);
    if (r.playerDied) {
      diedAt = i + 1;
      console.log(label, "DIED", diedAt, `${r.gx},${r.gy}`, r.deathMessage);
      console.log("  monsters", r.monsters.filter((m) => m.alive).map((m) => `${m.x},${m.y}${m.direction[0]}`));
      return;
    }
    if (r.completed) {
      console.log(
        label,
        "WIN",
        "moves",
        i + 1,
        "rem",
        msSecondsRemaining(210, r.buttonPressCtx.moveBoundary),
        "mb",
        r.buttonPressCtx.moveBoundary,
      );
      return;
    }
    void mBefore;
  }
  console.log(label, "alive end", `${r.gx},${r.gy}`, "chips", r.playerState.chipsRemainingOnMap);
}

sim("baseline", false);

// Patch: replace isMapCollectibleChipAt blocking for ALL monsters by converting
// approach - temporarily edit monsterTreatsChipAsWall via dynamic import won't work.
// Simulate chips-as-walls by making Chip collect none: turn chips into walls for monsters
// by placing gravel copies... 

// Manual: after each chip move, if a teeth sits on a cell that still has chip in ORIGINAL
// level, flag it. Track teeth that entered chip cells.
const orig = structuredClone(level);
normalizeLevelLayers(orig);
const r = createMsCc1SimulationRunner(structuredClone(level));
r.buttonPressCtx.stepParity = "odd";
const chipAt = (x: number, y: number) => {
  const u = orig.layers.upper[y * orig.width + x];
  return u === "chip" || u === "chip_w" || u === "chip_n" || u === "chip_e" || u === "chip_s";
};

for (let i = 0; i < 68; i++) {
  const before = r.monsters.filter((m) => m.alive).map((m) => ({ x: m.x, y: m.y, k: m.kind }));
  stepMsCc1Simulation(r, dirs[i]!);
  for (const m of r.monsters) {
    if (!m.alive) continue;
    const prev = before.find((b) => b.k === m.kind && (b.x !== m.x || b.y !== m.y));
    // match by nearest moved
  }
  // simpler: any teeth now on a cell that originally had chip AND chip still on map at that cell in working level
  for (const m of r.monsters) {
    if (!m.alive || m.kind !== "frog") continue;
    const prev = before.find((b) => Math.abs(b.x - m.x) + Math.abs(b.y - m.y) === 1);
    if (!prev) continue;
    if (prev.x === m.x && prev.y === m.y) continue;
    // Check if destination originally had a chip and Chip hasn't collected it yet
    // (chip still in working level)
    const stillChip =
      r.level.layers.upper[m.y * r.level.width + m.x]?.startsWith("chip") ||
      r.level.layers.lower[m.y * r.level.width + m.x]?.startsWith("chip");
    const origChip = chipAt(m.x, m.y);
    if (stillChip || (origChip && stillChip)) {
      console.log(
        `teeth walked onto chip cell at step ${i + 1}: ${prev.x},${prev.y}->${m.x},${m.y} stillChip=${stillChip}`,
      );
    }
  }
  if (r.playerDied) break;
}
