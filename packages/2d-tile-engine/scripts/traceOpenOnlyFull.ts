import { readFileSync } from "fs";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import {
  createMsCc1SimulationRunner,
  stepMsCc1Simulation,
  stepMsCc1Wait,
} from "../engine/msCc1/msCc1Simulation.js";
import { msSecondsRemaining } from "../engine/msCc1/msCc1Timing.js";
import type { Direction, LevelData } from "../engine/types.js";

type Action = Direction | "wait";

const level = JSON.parse(
  readFileSync(
    "../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-005.json",
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const actions: Action[] = [
  "up","up","right","up","up","up","up","left","left","left","left","left",
  "right","right","right","right","right",
  "down","down","down","down","down","down","down",
  "left","left","left","left","left","left","left","up","up","up",
  "down","down","down",
  "right","right","right","right","right","right","right",
  "up","up","up","up","up","up","up",
  "left","left","left","left","left","left","left","up",
  "up","left","up","right","right","right",
  "left","left","left","up","up","up","right","right","right",
  "wait","wait","wait","left","left","left","up","up","left","left",
];

const r = createMsCc1SimulationRunner(structuredClone(level));
let i = 0;
for (const a of actions) {
  i++;
  if (a === "wait") stepMsCc1Wait(r);
  else stepMsCc1Simulation(r, a);
  if (r.playerDied || r.completed || i % 10 === 0 || i > 50) {
    const fires = r.monsters.filter((m) => m.alive && m.kind === "fireball");
    console.log(
      i,
      a === "wait" ? "W" : a[0],
      `${r.gx},${r.gy}`,
      r.playerDied ? r.deathMessage : r.completed ? "WIN" : "",
      "fires",
      fires.map((f) => `${f.x},${f.y}`).join(" "),
      "rem",
      msSecondsRemaining(100, r.buttonPressCtx.moveBoundary),
    );
  }
  if (r.playerDied || r.completed) break;
}
