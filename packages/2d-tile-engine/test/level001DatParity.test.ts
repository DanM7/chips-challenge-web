import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { normalizeLevelLayers } from "../engine/levelLayers.js";
import { parseCcMoveStringMs } from "../engine/ccMoveNotation.js";
import { simulateMsCc1Level } from "../engine/msCc1/msCc1Simulation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webPath = path.join(
  __dirname,
  "../../../apps/chips-challenge-web/public/games/chips-challenge-1/levels/level-001.json",
);
const datPath = path.join(
  __dirname,
  "../../../../cc1-asset-extraction-pipeline/.tmp-level1",
);

const goldenTws =
  "2L,,l,,l,,L3,2Rr,,Rr,,2Rr,,R,,RLl,,Ll,,L3,Dd,d,,D,D,2Ll,L,LDd,,D3U5R2DR3,Rr,,2R,u,,2U,Dd,,D5L,d,,D3L4Rr,,R,Ll,,L,,Dd,,Dd,,Dd,,d";

const tworld132Tws =
  "3L,,2Lr,,r,,8R5L5D5L3D3U4R,,d,,d,,R2D4R,u,,UR3U3D5L2D3L6R3L6Dd";

describe("level 001 DAT parity", () => {
  it("web JSON matches fresh DAT export", () => {
    const web = JSON.parse(fs.readFileSync(webPath, "utf8"));
    const dat = JSON.parse(fs.readFileSync(datPath, "utf8"));
    normalizeLevelLayers(web);
    normalizeLevelLayers(dat);
    expect(web.layers.upper).toEqual(dat.layers.upper);
    expect(web.layers.lower).toEqual(dat.layers.lower);
    expect(web.playerStart).toEqual(dat.playerStart);
    expect(web.chipsRequired).toEqual(dat.chipsRequired);
  });

  it("pieguy TWS replay stalls (engine parity gap)", () => {
    const level = JSON.parse(fs.readFileSync(datPath, "utf8"));
    normalizeLevelLayers(level);
    const result = simulateMsCc1Level(structuredClone(level), parseCcMoveStringMs(goldenTws));
    expect(result.finalPosition).toEqual({ x: 13, y: 16 });
    expect(result.finalPlayerState.chipsRemainingOnMap).toBe(8);
    expect(result.completed).toBe(false);
  });

  it("Tile World 1.3.2 TWS replay hits same stall", () => {
    const level = JSON.parse(fs.readFileSync(datPath, "utf8"));
    normalizeLevelLayers(level);
    const result = simulateMsCc1Level(structuredClone(level), parseCcMoveStringMs(tworld132Tws));
    expect(result.finalPosition).toEqual({ x: 13, y: 16 });
    expect(result.finalPlayerState.chipsRemainingOnMap).toBe(8);
    expect(result.completed).toBe(false);
  });
});
