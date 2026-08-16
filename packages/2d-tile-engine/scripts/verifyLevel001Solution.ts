import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Direction, LevelData } from "../engine/types.js";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { simulateMsCc1Level } from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const level = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../../../cc1-asset-extraction-pipeline/.tmp-level1"),
    "utf8",
  ),
) as LevelData;
normalizeLevelLayers(level);

const moves = JSON.parse(
  fs.readFileSync(path.join(__dirname, "level001-solution.json"), "utf8"),
) as Direction[];

const result = simulateMsCc1Level(structuredClone(level), moves);
console.log(result);
process.exit(result.completed ? 0 : 1);
