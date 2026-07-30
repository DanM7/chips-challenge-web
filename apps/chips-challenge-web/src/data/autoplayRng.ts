/**
 * Deterministic stand-in for RNG monsters (walkers / blobs) during Auto Play.
 * Prefer a fixed turn order so routes are reproducible; refine per-level later.
 */
export type AutoplayRngKind = "walker" | "blob";

/** Stable pseudo-choice in 0..modulo-1 from a level seed + step index. */
export function deterministicAutoplayChoice(
  levelNumber: number,
  stepIndex: number,
  modulo: number,
): number {
  if (modulo <= 0) {
    return 0;
  }
  // xorshift-ish mix — good enough for best-effort bold proximity, not crypto.
  let x = (levelNumber * 374761393 + stepIndex * 668265263) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177) >>> 0;
  return x % modulo;
}

/**
 * When a walker would pick a random turn, Auto Play uses this instead of Math.random.
 * Returns index into the candidate direction list.
 */
export function pickDeterministicWalkerTurn(
  levelNumber: number,
  stepIndex: number,
  candidateCount: number,
): number {
  return deterministicAutoplayChoice(levelNumber, stepIndex, Math.max(1, candidateCount));
}
