/**
 * First-sweep verify for CC1 MS levels 41–60.
 * npx tsx packages/2d-tile-engine/scripts/verifyLevels41to60.ts
 */
import { runPresetBatch } from "./lib/verifyLevelBatch.js";

await runPresetBatch("41-60");
