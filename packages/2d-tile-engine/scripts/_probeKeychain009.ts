import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  cloneMsCc1SimulationRunner,
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
  type MsCc1SimulationRunner,
} from "../engine/msCc1/msCc1Simulation.js";
import { getCompositeTile, isDirtCell } from "../engine/levelRuntime.js";
import type { Direction, LevelData } from "../engine/types.js";

const level = JSON.parse(
  readFileSync(
    new URL(
      "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-009.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const dirs: Direction[] = ["up", "down", "left", "right"];
type Act = Direction | "wait";
const LETTER: Record<Direction, string> = { up: "U", down: "D", left: "L", right: "R" };

function toLetters(seq: Act[]): string {
  return seq.map((a) => (a === "wait" ? "W" : LETTER[a])).join("");
}

function expand(n: string): Act[] {
  const out: Act[] = [];
  const re = /(\d*)([UDLRW])/g;
  let m: RegExpExecArray | null;
  const s = n.replace(/\s+/g, "");
  while ((m = re.exec(s))) {
    const c = m[1] ? Number.parseInt(m[1], 10) : 1;
    const ch = m[2]!;
    for (let i = 0; i < c; i++) {
      out.push(
        ch === "W" ? "wait" : ch === "U" ? "up" : ch === "D" ? "down" : ch === "L" ? "left" : "right",
      );
    }
  }
  return out;
}

function apply(r: MsCc1SimulationRunner, seq: Act[]): void {
  for (const a of seq) {
    if (a === "wait") stepMsCc1Wait(r);
    else stepMsCc1Simulation(r, a);
    if (r.completed || r.playerDied) break;
  }
}

function key(r: MsCc1SimulationRunner): string {
  const toggles: string[] = [];
  const doors: string[] = [];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const t = getCompositeTile(r.level, x, y);
      if (t.startsWith("block_toggle")) toggles.push(`${x},${y}:${t.at(-1)}`);
      if (t.startsWith("door_")) doors.push(`${x},${y}`);
    }
  }
  return `${r.gx},${r.gy}|c${r.playerState.chipsRemainingOnMap}|k${r.playerState.keys.join(",")}|t${toggles.join(";")}|d${doors.join(";")}`;
}

function bfs(
  start: MsCc1SimulationRunner,
  maxDepth: number,
  maxNodes: number,
  done: (r: MsCc1SimulationRunner) => boolean,
  allowWait = false,
): Act[] | null {
  type N = { seq: Act[]; r: MsCc1SimulationRunner };
  const q: N[] = [{ seq: [], r: cloneMsCc1SimulationRunner(start) }];
  const seen = new Set([key(start)]);
  let nodes = 0;
  while (q.length && nodes < maxNodes) {
    const f = q.shift()!;
    nodes++;
    if (done(f.r)) {
      console.log("ok", nodes, toLetters(f.seq), `->${f.r.gx},${f.r.gy} keys=${f.r.playerState.keys} chips=${f.r.playerState.chipsRemainingOnMap}`);
      return f.seq;
    }
    if (f.r.playerDied || f.seq.length >= maxDepth) continue;
    const acts: Act[] = allowWait ? [...dirs, "wait"] : [...dirs];
    for (const a of acts) {
      const n = cloneMsCc1SimulationRunner(f.r);
      if (a === "wait") stepMsCc1Wait(n);
      else stepMsCc1Simulation(n, a);
      if (n.playerDied) continue;
      const k = key(n);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ seq: [...f.seq, a], r: n });
    }
  }
  console.log("fail", nodes);
  return null;
}

function status(r: MsCc1SimulationRunner, label: string): void {
  const toggles: string[] = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const t = getCompositeTile(r.level, x, y);
      if (t.startsWith("block_toggle")) toggles.push(`${x},${y}:${t}`);
    }
  console.log(
    label,
    `pos=${r.gx},${r.gy} tile=${getCompositeTile(r.level, r.gx, r.gy)} chips=${r.playerState.chipsRemainingOnMap} keys=${r.playerState.keys.join("+") || "-"}`,
    "toggles",
    toggles.join(" "),
  );
}

const TO_ICE =
  "RRRRLLDDDDUUUURRRRRRUURRRDRUUUDDDLLDRDRUUUUUUDDDLLLLDRRRDRUUUUUUDDDDDLLLLDRRRDRUUUUUUUUUDDDDDRRURRDLULDRULDR";

const r = createMsCc1SimulationRunner(structuredClone(level));
apply(r, expand(TO_ICE));
status(r, "after-ice");

// Map around green button / force / blue key
console.log("green area:");
for (let y = 6; y <= 22; y++) {
  let row = `${y}: `;
  for (let x = 17; x <= 26; x++) {
    if (x === r.gx && y === r.gy) {
      row += "C";
      continue;
    }
    const t = getCompositeTile(r.level, x, y);
    row +=
      t === "empty"
        ? "."
        : t === "wall"
          ? "#"
          : t === "button_green"
            ? "G"
            : t.startsWith("force")
              ? "F"
              : t === "key_blue"
                ? "B"
                : t.startsWith("door_")
                  ? "D"
                  : t.startsWith("key_")
                    ? "K"
                    : t.startsWith("block_toggle")
                      ? t.includes("open")
                        ? "o"
                        : "c"
                      : t === "ice"
                        ? "i"
                        : t[0]!;
  }
  console.log(row);
}

// Milestone: stand on green button
{
  const seq = bfs(r, 60, 300_000, (x) => getCompositeTile(x.level, x.gx, x.gy) === "button_green");
  if (seq) {
    apply(r, seq);
    status(r, "on-green-1");
  }
}

// Leave and return (second press) — SW: force boost both times
{
  const seq = bfs(
    r,
    40,
    300_000,
    (x) => {
      // toggles flipped twice = same as start? or blue key reachable
      // After 2 presses, toggles should match initial open/closed at 19,13 open and 19,15 closed etc.
      // Simpler: get blue key
      return x.playerState.keys.some((k) => k.includes("blue"));
    },
  );
  if (seq) {
    apply(r, seq);
    status(r, "blue-key");
  } else {
    // Try: step off force and back on green
    for (const notation of ["U D", "D U", "R L U D", "D R U U", "U U D D", "R U L D U"]) {
      const t = cloneMsCc1SimulationRunner(r);
      apply(t, expand(notation));
      status(t, "try " + notation);
    }
  }
}

// Continue key chain
{
  const seq = bfs(
    r,
    80,
    500_000,
    (x) => x.playerState.keys.some((k) => k.includes("red")) || getCompositeTile(x.level, 24, 15) !== "door_red",
    true,
  );
  if (seq) {
    apply(r, seq);
    status(r, "after-chain");
  }
}
