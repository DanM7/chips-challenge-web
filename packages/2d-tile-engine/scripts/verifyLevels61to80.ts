/**
 * First-sweep verify for CC1 MS levels 61–80.
 * npx tsx packages/2d-tile-engine/scripts/verifyLevels61to80.ts
 */
import { runPresetBatch } from "./lib/verifyLevelBatch.js";

await runPresetBatch("61-80");
