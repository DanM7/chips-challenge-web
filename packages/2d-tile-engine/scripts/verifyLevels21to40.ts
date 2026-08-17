/**
 * Second-sweep verify for CC1 MS levels 21–40.
 * npx tsx packages/2d-tile-engine/scripts/verifyLevels21to40.ts
 */
import { runPresetBatch } from "./lib/verifyLevelBatch.js";

await runPresetBatch("21-40");
