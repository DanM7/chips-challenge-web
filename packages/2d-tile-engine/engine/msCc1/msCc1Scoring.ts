/**
 * Microsoft Chip's Challenge (MSCC) end-of-level scoring.
 * @see https://wiki.bitbusters.club/Chip%27s_Challenge_scoring
 */

export interface MsLevelScoreBreakdown {
  /** Congratulatory line (depends on attempts to finish). */
  victoryMessage: string;
  timeBonus: number;
  levelBonus: number;
  levelScore: number;
  totalScore: number;
}

/** Seconds remaining × 10; untimed levels score 0. */
export function computeMsTimeBonus(secondsRemaining: number | null | undefined): number {
  if (secondsRemaining == null || secondsRemaining <= 0) {
    return 0;
  }
  // MS stores time bonus as a signed 16-bit value (overflow above ~3276 s).
  const seconds = Math.min(secondsRemaining, 3276);
  return seconds * 10;
}

/**
 * Level number × 500, reduced by 20% (floored) per prior death/restart on this level.
 * Stops decreasing once the bonus would fall below 500.
 */
export function computeMsLevelBonus(levelNumber: number, deathOrRestartCount: number): number {
  let bonus = Math.max(1, levelNumber) * 500;
  const penalties = Math.max(0, deathOrRestartCount);
  for (let i = 0; i < penalties; i++) {
    const next = Math.floor(bonus * 0.8);
    if (next < 500) {
      return 500;
    }
    bonus = next;
  }
  return bonus;
}

export function computeMsLevelScore(timeBonus: number, levelBonus: number): number {
  return timeBonus + levelBonus;
}

/** MS victory messages by attempt count (1 = first successful completion). */
export function msVictoryMessage(attemptCount: number): string {
  if (attemptCount <= 1) {
    return "Yowser! First Try!";
  }
  if (attemptCount <= 3) {
    return "Go Bit Buster!";
  }
  if (attemptCount <= 5) {
    return "Finished! Good Work!";
  }
  return "At last! You did it!";
}

export function buildMsLevelScoreBreakdown(options: {
  levelNumber: number;
  secondsRemaining: number | null | undefined;
  attemptCount: number;
  priorTotalScore: number;
}): MsLevelScoreBreakdown {
  const timeBonus = computeMsTimeBonus(options.secondsRemaining);
  const levelBonus = computeMsLevelBonus(
    options.levelNumber,
    Math.max(0, options.attemptCount - 1),
  );
  const levelScore = computeMsLevelScore(timeBonus, levelBonus);
  return {
    victoryMessage: msVictoryMessage(options.attemptCount),
    timeBonus,
    levelBonus,
    levelScore,
    totalScore: options.priorTotalScore + levelScore,
  };
}
